// WP8 mutation check (review F8): applies one mutation at a time to the BUILD OUTPUT (out/) of this checkout, runs the
// WP8 unit tests (tasks-placement, binding), the example cases and the extended 2.2 sets, records killed or survived,
// and restores the file byte for byte.
//
// It edits out/ in place: never run it beside other work on the same build (other tests, probes, a watch build or a
// second copy of this script), which would see the mutated code. Run it after `npm run build` and rebuild if it is
// interrupted. It is not part of `npm run check`.
//
// Usage: node scripts/mutations-wp8.mjs [M1,X7,...] [--all]   (default: every mutation, stopping at the first suite
// that kills it; --all runs every suite; prints a Markdown table)
// M1 to M26 are the author's WP8 mutations, X1 to X17 the review's, F1 to F5 the review fixes; anchors follow the code
// after the review fixes, so an anchor that moved reports "anchor found N times" instead of a result.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = 'out/src/language/placement.js', V = 'out/src/language/swaml-validator.js', S = 'out/src/simulation/simulator.js', B = 'out/src/language/binding.js', C = 'out/src/cli/binding.js', TM = 'out/src/simulation/timing.js';
const ONLY = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(',');
const MUTATIONS = [
    ['M1', 'osRole by name: a user Swaml::Os Task counts', P, ' && AstUtils.getDocument(x).uri.toString() === LIBRARY_2_3_URI)', ')'],
    ['M2', 'WP8-D01 message on every platform (literal draft)', V, 'if (placed?.unreleased && plan.coreRule)', 'if (placed?.unreleased)'],
    ['M3', 'occurrence placement overrides operation placement', P, '(family !== undefined ? byOperation.get(`${family}\\u0000${entry.operation}`) : undefined) ?? occurrence;', 'undefined ?? occurrence;'],
    ['M4', 'indexed path does not override its family', P, 'const found = byPath.get(path) ?? (family !== undefined ? byPath.get(family) : undefined)', 'const found = (family !== undefined ? byPath.get(family) : undefined) ?? byPath.get(path)'],
    ['M5', 'in-task position ignores deploy order', P, '.sort((x, y) => x.placement.index - y.placement.index || ', '.sort((x, y) => '],
    ['M6', 'ascending priority', S, 'return py - px;', 'return px - py;'],
    ['M7', 'unplaced before placed at equal priority', S, 'return x ? -1 : y ? 1 : 0;', 'return x ? 1 : y ? -1 : 0;'],
    ['M8', 'dispatch scan ignores keys', S, 'for (const f of this.tasked ? this.ordered : this.frames) {', 'for (const f of this.frames) {'],
    ['M9', 'deliveries carry no key', S, 'if (!this.tasked)\n            return undefined;\n        if (m.kind', 'if (true)\n            return undefined;\n        if (m.kind'],
    ['M10', 'rank ignored across Tasks', S, 'return x.rank - y.rank || x.position - y.position;', 'return x.position - y.position;'],
    ['M11', 'T1 off', V, 'x.priority !== undefined && x.priority === t.priority', 'false'],
    ['M12', 'T2 period multiple not checked', V, "t.periodNs && e.entry.kind === 'every' && !this.periodFits(e, t))", "t.periodNs && e.entry.kind === 'every' && false)"],
    ['M13', 'T2 after predecessor on another task accepted', V, 'before.every(p => p.task) ? before.find(p => p.task !== t) : undefined', 'undefined'],
    ['M14', 'T3 isr accepts every entries', V, "else if (t.kind === 'isr' && e.entry.kind !== 'receive')", "else if (t.kind === 'isr' && e.entry.kind === 'start')"],
    ['M15', 'T4 ignores suspending callees', P, 'if (target && isExecutable(target) && suspendSite(target, c, seen))', 'if (false)'],
    ['M16', 'T4 counts the machine idle selection', P, 'if (owner(n, isExecutable) !== own || a.isTransition(n) || owner(n, a.isTransition) && !owner(n, a.isBlock))', 'if (a.isTransition(n))\n            return n;\n        if (owner(n, isExecutable) !== own)'],
    ['M17', 'T5 equal deadline rejected', V, 'BigInt(deadline) < t.responseNs', 'BigInt(deadline) <= t.responseNs'],
    ['M18', 'T6 off', V, "once(d, this.unplacedMessage(plan, e, core), this.at(d, 'root'));", ';'],
    ['M19', 'T7 off', V, 'if (plan.coreRule)\n            for (const o of plan.software)', 'if (false)\n            for (const o of plan.software)'],
    ['M20', 'Tasks without a Core have no implicit Core', P, 'core: core ?? platform.name', 'core: core ?? o.path'],
    ['M21', 'binding: bcetNs = wcetNs rejected', B, 'c.bcetNs > c.wcetNs', 'c.bcetNs >= c.wcetNs'],
    ['M22', 'binding: duplicates accepted', B, 'else if (seen.has(id))', 'else if (false)'],
    ['M23', 'binding: forwarding is a route', B, 'left.child !== right.child ? forwarding : resolved.connections', 'false ? forwarding : resolved.connections'],
    ['M24', 'binding: schema version not checked', B, "if ('const' in p) {\n            if (x !== p.const)", "if ('const' in p) {\n            if (false)"],
    ['M25', 'binding check: findings fail', C, 'return errors ? 1 : 0;', 'return errors || notes ? 1 : 0;'],
    ['M26', 'wait expiries carry no key', S, 'this.resume(f);\n                }, () => f.token === token && !f.done, f.key);', 'this.resume(f);\n                }, () => f.token === token && !f.done);'],
    ['X1', 'a family path covers any suffix after [ (claims the children of its elements)', P, 'const m = /^(.*)\\[\\d+\\]$/u.exec(path);', 'const m = /^(.*?)\\[\\d+\\].*$/u.exec(path);'],
    ['X2', 'every Task has rank 0', P, '.map((o, rank) => {', '.map((o, rank0) => { const rank = 0;'],
    ['X3', 'in-task position ignores tree order', P, ' || x.occurrenceIndex - y.occurrenceIndex', ''],
    ['X4', 'T4 ignores receive statements', P, 'if (a.isWait(n) || a.isReceive(n))', 'if (a.isWait(n))'],
    ['X5', 'T4 ignores requests', P, "if (n.target.includes('.'))", 'if (false)'],
    ['X6', 'D11 accepts any uint', P, 'v <= BigInt(Number.MAX_SAFE_INTEGER)', 'true'],
    ['X7', 'start releases carry no key', S, 'this.at(0, 2, () => this.release(c, e), undefined, this.keyOf(c, e));', 'this.at(0, 2, () => this.release(c, e));'],
    ['X8', 'after releases are a separate unkeyed event with Tasks', S, 'if (this.tasked)\n                        this.release(f.c, e, undefined, f);', 'if (this.tasked)\n                        this.at(this.time, 2, () => this.release(f.c, e, undefined, f));'],
    ['X9', 'request expiries carry no key', S, "}, () => correlation.state === 'pending', f.key);", "}, () => correlation.state === 'pending');"],
    ['X10', 'receive timeouts carry no key', S, 'this.resume(f, {});\n                }, () => f.token === token && !f.done, f.key);', 'this.resume(f, {});\n                }, () => f.token === token && !f.done);'],
    ['X11', 'release omits task', S, '...(key ? { task: key.task } : {})', '...({})'],
    ['X12', 'binding: placed finding only for Task entries', B, 'if (e.placement)', 'if (e.task)'],
    ['X13', 'binding: every package connection is a route', B, 'ends.some(e => e.structure === plan.root)', 'true'],
    ['X14', 'binding: negative integers accepted', B, 'x < p.minimum || ', ''],
    ['X15', 'T3 preemptive not checked', V, "t.kind === 'isr' && t.preemptive === false", 'false'],
    ['X16', 'T6 only for entries without any placement', V, 'if (!e.task) {', 'if (!e.placement) {'],
    ['X17', 'timing lanes off', TM, "if (e.kind === 'release' && typeof e.task === 'string')", 'if (false)'],
    ['F1', 'preemption at statement boundaries (no Core lock)', S, 'if (holder && holder !== f)\n                continue;', 'if (false)\n                continue;'],
    ['F2a', 'T6 per platform again (any unplaced entry)', V, '.find(c => c !== undefined && plan.taskedCores.has(c));', '.find(c => true) ?? plan.tasks[0]?.core;'],
    ['F2b', 'D07 example ignores T2 to T4', V, 'const candidates = plan.tasks.filter(t => t.core === core && this.accepts(e, t));', 'const candidates = plan.tasks.filter(t => t.core === core);'],
    ['F2c', 'D07 example from any Core', V, 'const candidates = plan.tasks.filter(t => t.core === core && this.accepts(e, t));', 'const candidates = plan.tasks.filter(t => this.accepts(e, t));'],
    ['F3', 'a Task platform root is accepted', P, "const rootTask = roles.get(platform.name) === 'Task';", 'const rootTask = false;'],
    ['F12', 'positions restart per deployment', S, 'position: offset + e.position,', 'position: e.position,'],
];
const run = (args) => { try { execFileSync(process.execPath, args, { cwd: root, stdio: 'pipe', encoding: 'utf8', timeout: 900000 }); return true; } catch { return false; } };
const rows = [];
for (const [id, what, file, from, to] of MUTATIONS.filter(m => !ONLY || ONLY.includes(m[0]))) {
    const path = join(root, file), original = readFileSync(path, 'utf8');
    const count = original.split(from).length - 1;
    if (count !== 1) {
        rows.push([id, what, `anchor found ${count} times`, '']);
        console.error(rows.at(-1).join(' | '));
        continue;
    }
    writeFileSync(path, original.replace(from, to));
    try {
        // Cheapest first; a later suite runs only when the earlier ones pass (pass --all to run every suite).
        const all = process.argv.includes('--all');
        const unit = run(['--test', 'out/test/v2/tasks-placement.test.js', 'out/test/v2/binding.test.js']);
        const cases = unit || all ? run(['scripts/check-simulations.mjs']) : true;
        const extended = unit && cases || all ? run(['scripts/compatibility-2-2-extended.mjs']) : true;
        rows.push([id, what, !unit || !cases || !extended ? 'killed' : 'SURVIVED', [!unit && 'WP8 unit tests', !cases && 'example cases', !extended && 'extended 2.2 sets'].filter(Boolean).join(', ')]);
    }
    finally {
        writeFileSync(path, original);
    }
    console.error(rows.at(-1).join(' | '));
}
console.log('| Mutation | Change | Result | Killed by |\n| --- | --- | --- | --- |\n' + rows.map(r => `| ${r.join(' | ')} |`).join('\n'));
