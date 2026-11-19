// States-in-flow mutation check, packages 2a to 5 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md section 11): applies one
// mutation at a time, runs the suites of its package, records killed or survived, and restores the files byte for byte.
//
// Runtime mutations (packages 2a, 3, 4 and 5: ids A, C, D, E) edit the BUILD OUTPUT (out/src/simulation/simulator.js, and
// for D3 out/src/language/semantic.js) in place and run the states unit tests (every out/test/v2/states-*.test.js), then
// the example cases (check-simulations), then gate B. Package 2b mutations (ids B) edit the migrator
// scripts/migrate-machines.mjs and run its tests (test/ci/migrate-machines.test.mjs), then gate B
// (scripts/compatibility-machines.mjs). A mutation is one or more [anchor, replacement] edits; each anchor must occur
// exactly once. A3 and A4 ("look continuing after a leave", "on exit before the leave's block") are code mutations of
// several edits. Never run it beside other work on the same checkout (tests, probes, a watch build or a second copy of
// this script), which would see the mutated code. Run it in the foreground after `npm run build`, and rebuild if it is
// interrupted. It is not part of `npm run check`.
//
// Usage: node scripts/mutations-sif2.mjs [A1,B3,...] [--all]   (default: every mutation, stopping at the first suite that
// kills it; --all runs every suite; prints a Markdown table)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM = 'out/src/simulation/simulator.js', SEM = 'out/src/language/semantic.js', MIG = 'scripts/migrate-machines.mjs';
const ONLY = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(',');
/** [id, the plan's wording, file, anchor (exactly once), replacement] or [id, wording, file, [[anchor, replacement], …]] */
const MUTATIONS = [
    // Package 2a (section 11).
    ['A1', 'walk order reversed within a level', SIM, 'for (const item of stateItems(levels[level].state)) {', 'for (const item of [...stateItems(levels[level].state)].reverse()) {'],
    ['A2', 'a statement skipped at a message look', SIM, 'yield* this.statement(item, f, scope);', 'if (!input)\n                            yield* this.statement(item, f, scope);'],
    ['A3', 'look continuing after a leave (the first leave is remembered, the walk goes on to the last item)', SIM, [
        ['if (a.isExit(s) || a.isJump(s))\n            throw new LeaveSignal(s);', 'if (a.isExit(s) || a.isJump(s)) {\n            f.mutantLeave ??= { node: s, level: f.mutantLevel };\n            return voidValue();\n        }'],
        ['for (level = 0; level < levels.length; level++) {\n', 'for (level = 0; level < levels.length; level++) {\n                f.mutantLevel = level;\n'],
        ['return left ? { node: left, level } :', 'if (!left && f.mutantLeave) {\n            left = f.mutantLeave.node;\n            level = f.mutantLeave.level;\n        }\n        f.mutantLeave = undefined;\n        return left ? { node: left, level } :'],
    ]],
    ['A4', "on exit before the leave's block (a line whose block leaves runs the state's on exit first)", SIM, [
        ['yield* this.block(item.body, f, lineScope);', 'if (AstUtils.streamAst(item.body).some(n => a.isExit(n) || a.isJump(n)))\n                            for (const x of levels.at(-1).state.statements.filter(a.isStateAction).filter(x => x.kind === \'exit\'))\n                                yield* this.block(x.body, f, local);\n                        yield* this.block(item.body, f, lineScope);'],
    ]],
    ['A5', 'dropping input while busy', SIM, "if (this.findFrame(x => x.c === c && x.op === flowOwner && !x.done) || schedule(c.structure).some(e => e.kind === 'every' && e.operation === flowOwner.name))", 'if (false)'],
    ['A6', 'a timer present twice per arrival', SIM, 'l.presented.add(t);', 'void 0;'],
    ['A7', 'timer and delivery phases swapped (a timeout ends in phase 2)', SIM, 'this.at(this.time + y.timeout, 1,', 'this.at(this.time + y.timeout, 2,'],
    // A8 was written as "re-pick replaced by the picked message". It is equivalent (nothing can change the queue between the
    // start and the end of the zero-time wait), so the rule now takes the message picked when the wait begins; the mutation
    // is kept in its inverse form and is expected to survive.
    ['A8', 'picked message replaced by a re-pick at the end of the zero-time wait (equivalent; decision A8)', SIM, "this.resume(f, picked && picked.queue[0] === picked.m ? { input: this.take(picked.queue, picked.m, picked.endpointName, f.c) } : {});",
        "const h = this.flowHeads(f).find(x => named.has(x.endpointName));\n                    this.resume(f, h ? { input: this.take(h.queue, h.m, h.endpointName, f.c) } : {});"],
    ['A9', 'the two discard reasons swapped', SIM, "reason: left && !lineRan ? 'leftBeforeLine' : 'noEnabledTransition'", "reason: left && !lineRan ? 'noEnabledTransition' : 'leftBeforeLine'"],
    ['A10', 'if test counted as a step', SIM, 'if (a.isIf(s) && this.inLookText(s))', 'if (false)'],
    ['A11', 'named step that waits', SIM, 'if (!this.hasSomething(levels))\n                    left = { node: undefined', 'if (false)\n                    left = { node: undefined'],
    ['A12', 'exit; from a flow-level state not continuing with the next statement', SIM, 'if (yield* this.leave(levels, left.level, left.node, f, local, key))\n                        return voidValue();', 'if (yield* this.leave(levels, left.level, left.node, f, local, key))\n                        throw new ReturnValue(voidValue());'],
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
    // Package 4 (section 11): wakes and own writes (D8 to D10 mutated StateLoop, which is cut).
    ['D1', 'wakes by change instead of write', SIM, 'const c = this.cell(f, local, name); c.value = widen(value, c.type); this.noteWrite(f, local, name);', 'const c = this.cell(f, local, name); const old = JSON.stringify(c.value); c.value = widen(value, c.type); if (old !== JSON.stringify(c.value)) this.noteWrite(f, local, name);'],
    ['D2', 'read set including line blocks', SIM, 'if (!a.isStateAction(item) && !a.isEventLine(item)) {\n                    const r = this.readsOf(item, g.c.structure);', 'if (!a.isStateAction(item)) {\n                    const r = this.readsOf(item, g.c.structure);'],
    ['D3', 'read set ignoring redefinition (called operations resolved where they are written)', SEM, 'const op = localOperation(n, n.target, c), b = op', 'const op = localOperation(n, n.target), b = op'],
    ['D4', 'pending wake dropped', SIM, 'else\n            g.wakePending ??= why;', 'else\n            void why;'],
    ['D5', 're-look also after statement writes', SIM, 'yield* this.statement(item, f, scope);\n                        if (own)\n                            this.readsOf(item, f.c.structure).names.forEach(x => passed.add(x));',
        'f.lookWrites = own ? new Set() : undefined;\n                        yield* this.statement(item, f, scope);\n                        const statementWrites = f.lookWrites;\n                        f.lookWrites = undefined;\n                        if (own)\n                            this.readsOf(item, f.c.structure).names.forEach(x => passed.add(x));\n                        statementWrites?.forEach(x => { if (passed.has(x)) relook.add(x); });'],
    ['D6', 're-look position-free (every statement of the levels counts, also those after the line)', SIM, 'const passed = new Set(), relook = new Set(), own = this.relooks(f);', 'const passed = new Set(), relook = new Set(), own = this.relooks(f);\n        if (own)\n            for (const l of levels)\n                for (const it of stateItems(l.state))\n                    if (!a.isStateAction(it) && !a.isEventLine(it))\n                        this.readsOf(it, f.c.structure).names.forEach(x => passed.add(x));'],
    ['D7', 're-look in periodic machines', SIM, 'const passed = new Set(), relook = new Set(), own = this.relooks(f);', 'const passed = new Set(), relook = new Set(), own = true;'],
    // Package 5 (section 11): periodic machines.
    ['E1', 'on entry rerun at each release', SIM, 'f.reached = new Set([leaf]);', "f.reached = new Set([leaf]);\n            for (const x of leaf.statements.filter(a.isStateAction).filter(x => x.kind === 'entry'))\n                yield* this.block(x.body, f, f.flow.local);"],
    ['E2', 'timer reset by a skipped release', SIM, "            this.log('skip', this.label(f), { activation: f.id, source: this.source(f.entry), release: f.periodic.seq });", "            this.log('skip', this.label(f), { activation: f.id, source: this.source(f.entry), release: f.periodic.seq });\n        if (!holds && f.flow)\n            for (const l of f.flow.levels) {\n                l.entered = this.time;\n                l.presented.clear();\n            }"],
    ['E3', 'two messages taken in one release (the second is consumed by the same release)', SIM, 'f.reached = new Set([leaf]);\n            this.dropUnnamed(f, named);\n            const h = this.flowHeads(f).find(x => named.has(x.endpointName));', 'f.reached = new Set([leaf]);\n            this.dropUnnamed(f, named);\n            const h = this.flowHeads(f).find(x => named.has(x.endpointName));\n            const second = h && this.flowHeads(f).filter(x => named.has(x.endpointName) && x !== h)[0];\n            if (second)\n                this.take(second.queue, second.m, second.endpointName, f.c);'],
    ['E4', 'arrival look skipped (every arrival in a periodic machine waits for the next release)', SIM, 'f.held = held;', 'f.held = true;'],
    ['E5', 'bound counting the first arrival (a state is held at its first arrival in a release)', SIM, 'held = f.reached.has(s);', 'held = f.reached.has(s) || f.reached.size === 0;'],
    ['E6', 'periodic end treated as a completion', SIM, "this.log('periodicEnd', this.label(f), { activation: f.id, release: f.periodic.seq });\n            yield* this.nextRelease(f, new Set());", 'return voidValue();'],
    ['E7', 'bound applied in waiting machines', SIM, 'return yield* this.periodicMachine(f);', 'return yield* this.periodicMachine(f);\n        f.reached = new Set();'],
    ['E8', 'skip without activation', SIM, "this.log('skip', this.label(f), { activation: f.id, source: this.source(f.entry), release: f.periodic.seq });", "this.log('skip', this.label(f), { source: this.source(f.entry), release: f.periodic.seq });"],
    ['E9', 'deadline measured once from the dispatch, not per release', SIM, "            // The deadline is per release, from the release (SIF-R15).\n            if (deadline)", "            // The deadline is per release, from the release (SIF-R15).\n            if (false)"],
];
const run = (command, args) => { try { execFileSync(command, args, { cwd: root, stdio: 'pipe', encoding: 'utf8', timeout: 1500000 }); return true; } catch { return false; } };
const node = args => run(process.execPath, args);
const statesTests = readdirSync(join(root, 'out/test/v2')).filter(f => /^states-.*\.test\.js$/.test(f)).map(f => `out/test/v2/${f}`);
const suites = id => id.startsWith('B')
    ? [['migrator tests', ['--test', 'test/ci/migrate-machines.test.mjs']], ['gate B', ['scripts/compatibility-machines.mjs']]]
    : [['states unit tests', ['--test', ...statesTests]], ['example cases', ['scripts/check-simulations.mjs']], ['gate B', ['scripts/compatibility-machines.mjs']]];
const rows = [];
for (const [id, what, file, from, to] of MUTATIONS.filter(m => !ONLY || ONLY.includes(m[0]))) {
    const path = join(root, file), original = readFileSync(path, 'utf8');
    let text = original.replace(/\r\n/g, '\n'), problem = '';
    for (const [anchor, replacement] of Array.isArray(from) ? from : [[from, to]]) {
        const count = text.split(anchor).length - 1;
        if (count !== 1) {
            problem = `anchor found ${count} times: ${anchor.split('\n')[0]}`;
            break;
        }
        text = text.replace(anchor, () => replacement);
    }
    if (problem) {
        rows.push([id, what, problem, '']);
        console.error(rows.at(-1).join(' | '));
        continue;
    }
    writeFileSync(path, text);
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
