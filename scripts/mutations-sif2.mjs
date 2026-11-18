// States-in-flow packages 2a and 2b mutation check (docs/proposals/STATES_IN_FLOW_PROPOSAL.md section 11): applies one
// mutation at a time, runs the suites of its package, records killed or survived, and restores the file byte for byte.
//
// Package 2a mutations (flat states) edit the BUILD OUTPUT out/src/simulation/simulator.js in place and run the states unit
// tests (states-in-flow, states-in-flow-samples), then the example cases (check-simulations), then gate B. Package 2b
// mutations edit the migrator scripts/migrate-machines.mjs and run its tests (test/ci/migrate-machines.test.mjs), then
// gate B (scripts/compatibility-machines.mjs). Package 3 mutations (parents) edit the build output too and run the
// same suites as 2a. Never run it beside other work on the same checkout (tests, probes, a watch build or a second copy
// of this script), which would see the mutated code. Run it after `npm run build`, and rebuild if it is interrupted. It
// is not part of `npm run check`.
//
// Not expressible as one text mutation, so not here: "look continuing after a leave" and "on exit before the leave's block"
// (2a); the states tests cover them (SIF-R02 end of the look, SIF-R09 text order).
//
// Usage: node scripts/mutations-sif2.mjs [A1,B3,...] [--all]   (default: every mutation, stopping at the first suite that
// kills it; --all runs every suite; prints a Markdown table)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM = 'out/src/simulation/simulator.js', MIG = 'scripts/migrate-machines.mjs';
const ONLY = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(',');
/** [id, the plan's wording, file, anchor (exactly once), replacement] */
const MUTATIONS = [
    // Package 2a (section 11).
    ['A1', 'walk order reversed within a level', SIM, 'for (const item of stateItems(levels[level].state)) {', 'for (const item of [...stateItems(levels[level].state)].reverse()) {'],
    ['A2', 'a statement skipped at a message look', SIM, 'yield* this.statement(item, f, scope);', 'if (!input)\n                            yield* this.statement(item, f, scope);'],
    ['A5', 'dropping input while busy', SIM, 'if (this.findFrame(x => x.c === c && x.op === flowOwner && !x.done))', 'if (false)'],
    ['A6', 'a timer present twice per arrival', SIM, 'l.presented.add(t);', 'void 0;'],
    ['A7', 'timer and delivery phases swapped (a timeout ends in phase 2)', SIM, 'this.at(this.time + y.timeout, 1,', 'this.at(this.time + y.timeout, 2,'],
    ['A8', 're-pick replaced by the picked message', SIM, 'this.dropUnnamed(f, named);\n                this.at(this.time, 2, () => {\n                    if (f.token !== token || !f.suspended)\n                        return;\n                    const h = this.flowHeads(f).find(x => named.has(x.endpointName));',
        'this.dropUnnamed(f, named);\n                const picked = this.flowHeads(f).find(x => named.has(x.endpointName));\n                this.at(this.time, 2, () => {\n                    if (f.token !== token || !f.suspended)\n                        return;\n                    const h = picked;'],
    ['A9', 'the two discard reasons swapped', SIM, "reason: left && !lineRan ? 'leftBeforeLine' : 'noEnabledTransition'", "reason: left && !lineRan ? 'noEnabledTransition' : 'leftBeforeLine'"],
    ['A10', 'if test counted as a step', SIM, 'if (a.isIf(s) && this.inLookText(s))', 'if (false)'],
    ['A11', 'named step that waits', SIM, 'const left = this.hasSomething(levels) ? yield*', 'const left = true ? yield*'],
    ['A12', 'exit; from a flow-level state not continuing with the next statement', SIM, 'if (yield* this.leave(levels, left.level, left.node, f, local, key))\n                    return voidValue();', 'if (yield* this.leave(levels, left.level, left.node, f, local, key))\n                    throw new ReturnValue(voidValue());'],
    ['A13', 'backward jump not re-running a declaration', SIM, 'yield* this.statement(b.statements[i], f, local);', 'if (!(a.isLocalVariable(b.statements[i]) && local.has(b.statements[i].name)))\n                    yield* this.statement(b.statements[i], f, local);'],
    // Package 2b (section 11): the migrator.
    ['B1', 'chain order by target instead of declaration', MIG, 'const transitions = s.transitions.filter(t => t.endpoint === member);', 'const transitions = s.transitions.filter(t => t.endpoint === member).sort((x, y) => String(x.target).localeCompare(String(y.target)));'],
    ['B2', 'exit actions copied only into some leaving blocks', MIG, 'if (copyExit)\n                for (const [i, st] of exitStatements.entries()) {', 'if (copyExit && t === s.transitions[0])\n                for (const [i, st] of exitStatements.entries()) {'],
    ['B3', 'dead-timer rule removing a smaller timer', MIG, 'durationNs(u.delay) <= durationNs(t.delay)', 'durationNs(u.delay) >= durationNs(t.delay)'],
    ['B4', 'finals without return;', MIG, "if (s.final && i < order.length - 1) steps.push('return');", 'void 0;'],
    ['B5', 'dead end migrated as a named step', MIG, 'if (!s.final && !s.transitions.length && !s.deferrals?.length)\n            report.refused.push(', 'if (false)\n            report.refused.push('],
    ['B6', 'identity map off by one statement', MIG, 'map[`${path}/${n}`] = oldTransition(s, t);', 'map[`${path}/${n + 1}`] = oldTransition(s, t);'],
    // Package 3 (section 11): parents.
    ['C1', 'inner first: the levels of a look walked innermost first', SIM, 'for (level = 0; level < levels.length; level++) {\n                // A local declared', 'for (level = levels.length - 1; level >= 0; level--) {\n                // A local declared'],
    ['C2', "parent on exit before the inner's", SIM, 'const l = levels.pop();', 'const l = levels.splice(n, 1)[0];'],
    ['C3', 'parent timer restarting at inner changes', SIM, 'if (!queue.length && innerStates(s).length)\n                queue.push(innerStates(s)[0]);', 'if (!queue.length && innerStates(s).length)\n                queue.push(innerStates(s)[0]);\n            if (levels.length > 1)\n                for (const l of levels.slice(0, -1)) {\n                    l.entered = this.time;\n                    l.presented.clear();\n                }'],
    ['C4', 'a leaf with no items inside a parent with lines not waiting', SIM, 'hasSomething(levels) { return levels.some(', 'hasSomething(levels) { return levels.slice(-1).some('],
    ['C5', 'exit; from the last inner state not leaving the parent', SIM, 'if (i < siblings.length - 1) {', 'if (i < siblings.length - 1 || true) {\n                    if (i === siblings.length - 1)\n                        return false;'],
];
const run = (command, args) => { try { execFileSync(command, args, { cwd: root, stdio: 'pipe', encoding: 'utf8', timeout: 1500000 }); return true; } catch { return false; } };
const node = args => run(process.execPath, args);
const suites = id => id.startsWith('B')
    ? [['migrator tests', ['--test', 'test/ci/migrate-machines.test.mjs']], ['gate B', ['scripts/compatibility-machines.mjs']]]
    : [['states unit tests', ['--test', 'out/test/v2/states-in-flow.test.js', 'out/test/v2/states-in-flow-samples.test.js', ...(id.startsWith('C') ? ['out/test/v2/states-parents.test.js'] : [])]], ['example cases', ['scripts/check-simulations.mjs']], ['gate B', ['scripts/compatibility-machines.mjs']]];
const rows = [];
for (const [id, what, file, from, to] of MUTATIONS.filter(m => !ONLY || ONLY.includes(m[0]))) {
    const path = join(root, file), original = readFileSync(path, 'utf8'), text = original.replace(/\r\n/g, '\n');
    const count = text.split(from).length - 1;
    if (count !== 1) {
        rows.push([id, what, `anchor found ${count} times`, '']);
        console.error(rows.at(-1).join(' | '));
        continue;
    }
    writeFileSync(path, text.replace(from, to));
    try {
        const killers = [];
        for (const [name, args] of suites(id)) {
            if (killers.length && !process.argv.includes('--all'))
                break;
            if (!node(args))
                killers.push(name);
        }
        rows.push([id, what, killers.length ? 'killed' : 'SURVIVED', killers.join(', ')]);
    }
    finally {
        writeFileSync(path, original);
    }
    console.error(rows.at(-1).join(' | '));
}
console.log('| Mutation | Change | Result | Killed by |\n| --- | --- | --- | --- |\n' + rows.map(r => `| ${r.join(' | ')} |`).join('\n'));
