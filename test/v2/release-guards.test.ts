// WP7 of swa.ml 2.3: release guards on every, receive and after schedule entries (ADR 0025, B19): WP7-G01,
// WP7-S01..S03, WP7-D01, WP7-D02, WP7-R01..R07, WP7-T01, WP7-T02, WP7-M01..M03.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { sampledMembers, schedule } from '../../src/language/semantic.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { viewCandidates } from '../../src/language/presentation.js';
import { runTests, simulate } from '../../src/simulation/simulator.js';
import { projectOperationTiming } from '../../src/simulation/timing.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, run, valid, workspace } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const errors = async (source: string) => (await parse(source)).errors.map(e => [String(e.code), String(e.message)]);
const kinds = (trace: Observation[], kind: string) => trace.filter(o => o.kind === kind);
const ms = (o: Observation) => o.timeNs / 1e6;

/**
 * A component C with the given members and schedule inside package Test, an event source Src that publishes
 * go(k) with k = 1, 2, ... every 10 ms and sends a power mode, and the occurrence Demo connecting them. C samples the
 * mode in modeNow and consumes go with take unless the given entries do.
 */
const model = (members: string, entries: string, more = '') => `package Test {
  import Swaml::Time;
  enum PowerMode { run, sleep }
  port def M { provides event go(n: int); }
  port def Mode { provides attribute current: PowerMode = PowerMode.run; }
  component def Src { port out: M; port mode: Mode; attribute k: int = 0; operation tick() { k = k + 1; publish out.go(k); send mode.current(if (k % 3 == 0) PowerMode.sleep else PowerMode.run); } schedule { on every 10ms tick(); } }
  component def C { reversed port inp: M; reversed port mode: Mode; attribute awake: bool = true; attribute runs: uint = 0; attribute nexts: uint = 0; attribute got: int = 0; attribute last: uint = 0;
    operation slot() { runs = runs + 1; }
    operation next() { nexts = nexts + 1; }
    operation take(v: int) { got = v; }
    operation modeNow() returns bool { return mode.current == PowerMode.run; }
    ${members}
    schedule { ${entries}${entries.includes('inp.go') ? '' : ' on receive inp.go(v) take(v);'} }
  }
  component Demo { component s: Src; component c: C; connect (s.out, c.inp); connect (s.mode, c.mode); }
  ${more}
}`;

test('WP7-G01 a release guard parses after the operation call and before deadline and concurrent', async () => {
    const { model: m } = await valid(model('', 'on every 10ms slot() when (awake) deadline 2ms; after slot next() when (not awake); on receive inp.go(v) take(v) when (v > 1) concurrent;'.replace(' concurrent', '')));
    const entries = m.packages[0].elements.filter(a.isComponentDef).find(c => c.name === 'C')!.members.filter(a.isSchedule)[0].entries;
    assert.deepEqual(entries.map(e => [e.kind, e.guard?.$type, e.guard?.$cstNode?.text]), [['every', 'ReferenceExpression', 'awake'], ['after', 'UnaryExpression', 'not awake'], ['receive', 'BinaryExpression', 'v > 1']]);
    assert.equal(entries[0].deadline?.value, 2);
    // A guard after deadline or concurrent, or without parentheses, is a syntax error.
    for (const entry of ['on every 10ms slot() deadline 2ms when (awake);', 'on every 10ms slot() when awake;', 'on every 10ms slot() concurrent when (awake);', 'on every 10ms slot() when ();'])
        assert.ok((await parse(model('', entry))).doc.parseResult.parserErrors.length, entry);
    // A concurrent guarded entry parses with concurrent after the guard and the deadline.
    const r = await parse(model('operation peek() { }', 'on every 10ms peek() when (awake) deadline 1ms concurrent;'));
    assert.deepEqual(r.doc.parseResult.parserErrors, []);
    assert.deepEqual(r.errors.map(e => e.message), []);
});

test('WP7-S01 WP7-D01 a release guard on a start or call entry is SW2007, once, and is not typed', async () => {
    const source = `package Test {
  port def Svc { provides operation get(n: int) returns int; }
  component def C { optional port api: Svc; attribute armed: bool = true;
    operation boot() { }
    operation serve(n: int) returns int { return n; }
    schedule { on start boot() when (armed); on call api.get(n) serve(n) when (n > 0 and missing); }
  }
  component def D specializes C { }
  component Demo { component c: D; }
}`;
    assert.deepEqual(await errors(source), [
        ['SW2007', 'A release guard is allowed only on every, receive and after entries.'],
        ['SW2007', 'A release guard is allowed only on every, receive and after entries.'],
    ]);
});

test('WP7-S02 WP7-D02 a release guard is bool, pure or reads state, in the scope of attributes, sampled ports, now() and receive bindings', async () => {
    const helpers = 'operation ready() returns bool { return awake and runs < 10; } operation bump() returns bool { runs = runs + 1; return true; } operation shout() returns bool { publish inp2.go(1); return true; } operation slow() returns bool { wait 1ms; return true; } operation par(x: int) { got = x; }';
    const port = 'optional port inp2: M;';
    // Valid: attributes, a reading helper, now(), a sampled port member and a receive binding.
    await valid(model(`${port} ${helpers}`, 'on every 10ms slot() when (ready() and now() >= 0 and mode.current != PowerMode.sleep); on receive inp.go(v) take(v) when (v % 2 == 0 and awake);'));
    const cases: [string, string[][]][] = [
        ['on every 10ms slot() when (runs);', [['SW2007', 'Release guard must be bool, found uint.']]],
        ['on every 10ms slot() when (1 + 2);', [['SW2007', 'Release guard must be bool, found int.']]],
        ['on every 10ms slot() when (bump());', [['SW2007', 'Release guard must be pure or read state.']]],
        ['on every 10ms slot() when (shout());', [['SW2007', 'Release guard must be pure or read state.']]],
        // A suspending call is reported by the call rules only, once.
        ['on every 10ms slot() when (slow());', [['SW2006', 'Suspending calls must be standalone statements or whole values of ordinary variable declarations or assignments, optionally in try. Store their result before using it in an expression or loop header.']]],
        // The operation's parameters are not in scope; the name keeps its existing unresolved message.
        ['on every 10ms par(1) when (x);', [['SW2002', 'Unknown local value x; nested operations never capture enclosing locals and component attributes are private.']]],
        // An unresolved call is reported by the call rules only.
        ['on every 10ms slot() when (nothing());', [['SW2006', 'Unknown operation nothing; remote calls require an owned port.']]],
        // The bindings belong to the receive entry; an every entry has none.
        ['on every 10ms slot() when (v);', [['SW2002', 'Unknown local value v; nested operations never capture enclosing locals and component attributes are private.']]],
    ];
    for (const [entry, expected] of cases)
        assert.deepEqual(await errors(model(`${port} ${helpers}`, entry)), expected, entry);
});

/** The SW2020 warnings of a source, with their code, message and the text they cover. */
const guardWarnings = async (source: string) => {
    const r = await parse(source), lines = source.split('\n');
    assert.deepEqual(r.errors.map(e => [e.code, e.message]), []);
    return r.warnings.filter(w => w.code === 'SW2020').map(w => [String(w.message), w.range.start.line === w.range.end.line ? lines[w.range.start.line].slice(w.range.start.character, w.range.end.character) : '(lines)']);
};

test('WP7-D03 (SW2020) a release guard that folds to false is reported at the guard; a redefined const is left alone', async () => {
    const dead = (guard: string, entry = 'on every 10ms slot', op = 'slot') => `Release guard when (${guard}) of ${entry} is always false; the entry never runs ${op}.`;
    for (const guard of ['false', '1 == 2', 'not true', 'off', 'off and not off', 'limit > 3'])
        assert.deepEqual(await guardWarnings(model('const attribute off: bool = false; const attribute limit: int = 2;', `on every 10ms slot() when (${guard});`)), [[dead(guard), guard]], guard);
    // Receive and after entries too; names are spelled as in 2.2 (a contextual word is quoted).
    assert.deepEqual(await guardWarnings(model('const attribute view: bool = false;', 'on receive inp.go(v) take(v) when (view); after take next() when (false);')),
        [[dead("'view'", 'on receive inp.go take', 'take'), 'view'], [dead('false', 'after take next', 'next'), 'false']]);
    // A guard that is true, that cannot fold or that reads state: no diagnostic.
    for (const guard of ['true', 'not off', 'awake', 'off and awake', 'now() >= 0', 'limit == 2'])
        assert.deepEqual(await guardWarnings(model('const attribute off: bool = false; const attribute limit: int = 2;', `on every 10ms slot() when (${guard});`)), [], guard);
    // A const that a specialization or usage redefines folds per occurrence: not reported, and the redefinition decides the run.
    const redefined = (more: string) => model('const attribute off: bool = false;', 'on every 10ms slot() when (off);', more);
    for (const more of ['component def On specializes C { redefines const attribute off: bool = true; }', 'component Holder { component s: Src; component c: C { redefines const attribute off: bool = true; } connect (s.out, c.inp); connect (s.mode, c.mode); }'])
        assert.deepEqual(await guardWarnings(redefined(more)), [], more);
    const { model: m } = await valid(redefined('component Holder { component s: Src; component c: C { redefines const attribute off: bool = true; } connect (s.out, c.inp); connect (s.mode, c.mode); }'));
    assert.equal(simulate([m], 'Test::Holder', { untilNs: 21_000_000 }).stores['Holder.c'].runs, 2);
    // A redefinition of another component's const of the same name does not hide it (the declaration decides).
    assert.deepEqual(await guardWarnings(redefined('component def K { const attribute off: bool = true; } component def L specializes K { redefines const attribute off: bool = false; }')), [[dead('off'), 'off']]);
    // A start entry's guard is already an error and gets no warning besides it.
    assert.deepEqual((await parse(model('', 'on start next() when (false);'))).warnings.filter(w => w.code === 'SW2020'), []);
});

test('WP7-S03 the guard is not part of entry identity: duplicates, and a derived entry replaces the guarded base entry', async () => {
    assert.deepEqual(await errors(model('', 'on every 10ms slot() when (awake); on every 10ms slot();')), [['SW2007', 'Duplicate (trigger, operation) entry.']]);
    assert.deepEqual(await errors(model('', 'on every 10ms slot() when (awake); on every 10ms slot() when (not awake);')), [['SW2007', 'Duplicate (trigger, operation) entry.']]);
    // Specialization and a usage-level schedule replace the entry with its guard, or without one.
    const source = (derived: string, usage: string) => `package Test {
  component def Base { attribute awake: bool = false; attribute runs: uint = 0; operation slot() { runs = runs + 1; } schedule { on every 10ms slot() when (awake); } }
  component def Derived specializes Base { ${derived} }
  component Demo { component base: Base; component derived: Derived; component usage: Base { ${usage} } }
}`;
    const { model: m } = await valid(source('schedule { on every 10ms slot(); }', 'redefines attribute awake: bool = true;'));
    const result = simulate([m], 'Test::Demo', { untilNs: 35_000_000 });
    assert.deepEqual([result.stores['Demo.base'].runs, result.stores['Demo.derived'].runs, result.stores['Demo.usage'].runs], [0, 3, 3]);
    const { model: m2 } = await valid(source('redefines attribute awake: bool = true; schedule { on every 10ms slot() when (not awake); }', 'schedule { on every 10ms slot() when (true); }'));
    const r2 = simulate([m2], 'Test::Demo', { untilNs: 35_000_000 });
    assert.deepEqual([r2.stores['Demo.base'].runs, r2.stores['Demo.derived'].runs, r2.stores['Demo.usage'].runs], [0, 0, 3]);
    const derived = m2.packages[0].elements.filter(a.isComponentDef).find(c => c.name === 'Derived')!;
    assert.equal(schedule(derived)[0].guard?.$cstNode?.text, 'not awake');
});

test('WP7-S02 an inherited guard is typed in every effective structure: a redefined helper that writes is an error, never a run-time fault', async () => {
    const source = (redefinition: string) => `package Test {
  component def Base { attribute runs: uint = 0; attribute calls: uint = 0; operation ready() returns bool { return runs < 2; } operation slot() { runs = runs + 1; } schedule { on every 10ms slot() when (ready()); } }
  component def Derived specializes Base { ${redefinition} }
  component Demo { component d: Derived; }
}`;
    assert.deepEqual(await errors(source('redefines operation ready() returns bool { calls = calls + 1; return true; }')), [['SW2007', 'Release guard must be pure or read state.']]);
    const { model: m } = await valid(source('redefines operation ready() returns bool { return runs < 3; }'));
    assert.equal(simulate([m], 'Test::Demo', { untilNs: 55_000_000 }).stores['Demo.d'].runs, 3, 'the redefined helper decides');
    // A redefined attribute keeps its type and gives the guard its own initial value.
    const { model: m3 } = await valid(`package Test {
  component def Base { attribute limit: uint = 1; attribute runs: uint = 0; operation slot() { runs = runs + 1; } schedule { on every 10ms slot() when (runs < limit); } }
  component Demo { component d: Base { redefines attribute limit: uint = 4; } }
}`);
    assert.equal(simulate([m3], 'Test::Demo', { untilNs: 75_000_000 }).stores['Demo.d'].runs, 4);
});


/** A self-contained component whose guards read the logical clock, so skips fall on known instants. */
const clocked = (members: string, entries: string, scripts = '') => `package Test {
  import Swaml::Time;
  component def C { attribute runs: uint = 0; attribute nexts: uint = 0; attribute lasts: uint = 0; attribute d: int = 0; attribute toggles: uint = 0;
    operation slot() { runs = runs + 1; }
    operation next() { nexts = nexts + 1; }
    operation last() { lasts = lasts + 1; }
    operation toggle() { toggles = toggles + 1; }
    operation ratio() returns int { var big: int = 100; return big % d; }
    ${members}
    schedule { ${entries} }
  }
  component c: C;
  ${scripts}
}`;
const runClocked = async (members: string, entries: string, untilNs: number) => simulate([(await valid(clocked(members, entries))).model], 'Test::c', { untilNs });
const at = (trace: Observation[], subject: string, ...which: string[]) => trace.filter(o => o.subject === subject && which.includes(o.kind)).map(o => [ms(o), o.kind]);
const line = (trace: Observation[], subject: string) => at(trace, subject, 'complete', 'skip').map(x => x.join(' '));

test('WP7-R02 WP7-R05 WP7-T01 a false guard skips: no operation runs, skip names the entry, the lock is released and the grid stays on kD', async () => {
    const r = await runClocked('', 'on every 10ms slot() when (now() % 30ms != 0); on every 10ms toggle();', 61_000_000);
    assert.deepEqual(line(r.trace, 'c.slot'), ['10 complete', '20 complete', '30 skip', '40 complete', '50 complete', '60 skip']);
    // Every release stays on the grid 10 ms, 20 ms, ... whatever the guard results.
    assert.deepEqual(at(r.trace, 'c.slot', 'release').map(([t]) => t), [10, 20, 30, 40, 50, 60]);
    assert.equal(r.stores.c.runs, 4);
    const skip = kinds(r.trace, 'skip')[0];
    assert.deepEqual(Object.keys(skip).sort(), ['activation', 'kind', 'ordinal', 'source', 'subject', 'timeNs']);
    assert.equal(skip.source, 'Test::C/schedule/0');
    // The skipped activation was dispatched under the lock and released it, as a completion does; toggle then runs at the same instant.
    const id = skip.activation;
    assert.deepEqual(r.trace.filter(o => o.activation === id).map(o => o.kind), ['release', 'dispatch', 'unlock', 'skip']);
    assert.ok(r.trace.some(o => o.kind === 'complete' && o.subject === 'c.toggle' && o.timeNs === 30_000_000 && o.ordinal > skip.ordinal));
    assert.equal(r.outcome, 'no-failure-observed');
    assert.equal(r.stores.c.toggles, 6);
});

test('WP7-R02 the deadline armed at a skipped release is cancelled; an armed deadline still applies when the guard is true', async () => {
    const members = 'operation slow() { wait 5ms; runs = runs + 1; }';
    const skipped = await runClocked(members, 'on every 10ms slow() when (now() >= 100ms) deadline 2ms;', 95_000_000);
    assert.equal(skipped.status, 'horizon');
    assert.equal(kinds(skipped.trace, 'violation').length, 0);
    assert.equal(kinds(skipped.trace, 'skip').length, 9);
    const ran = await runClocked(members, 'on every 10ms slow() when (now() >= 100ms) deadline 2ms;', 150_000_000);
    assert.equal(ran.status, 'violation');
    assert.deepEqual(kinds(ran.trace, 'violation').map(o => [ms(o), o.code]), [[102, 'Deadline']]);
});

test('WP7-R03 a skip counts as a successful whole completion for after successors, which apply their own guards', async () => {
    const r = await runClocked('', 'on every 10ms slot() when (now() % 20ms != 0); after slot next() when (now() % 30ms != 0); after next last();', 61_000_000);
    assert.deepEqual(line(r.trace, 'c.slot'), ['10 complete', '20 skip', '30 complete', '40 skip', '50 complete', '60 skip']);
    assert.deepEqual(line(r.trace, 'c.next'), ['10 complete', '20 complete', '30 skip', '40 complete', '50 complete', '60 skip']);
    assert.deepEqual([r.stores.c.runs, r.stores.c.nexts, r.stores.c.lasts], [3, 4, 6]);
    // A successor is released at the time of the skip and names the skipped activation as its predecessor.
    const skip = kinds(r.trace, 'skip')[0];
    const successor = r.trace.find(o => o.kind === 'release' && o.predecessorActivation === skip.activation)!;
    assert.deepEqual([successor.subject, successor.timeNs], ['c.next', skip.timeNs]);
});

test('WP7-R04 WP7-T02 a receive entry consumes its input at release; a false guard discards it with reason releaseGuard', async () => {
    const r = await run(model('', 'on receive inp.go(v) take(v) when (v % 2 == 0);'), 41_000_000);
    assert.deepEqual(line(r.trace, 'Demo.c.take'), ['10 skip', '20 complete', '30 skip', '40 complete']);
    assert.equal(r.stores['Demo.c'].got, 4);
    const discards = kinds(r.trace, 'discardInput');
    assert.equal(discards.length, 2);
    for (const d of discards) {
        assert.deepEqual(Object.keys(d).sort(), ['activation', 'kind', 'message', 'ordinal', 'reason', 'source', 'subject', 'timeNs']);
        assert.deepEqual([d.subject, d.reason, d.source], ['inp.go', 'releaseGuard', 'Test::Src.tick/1']);
        // The discarded message is the one delivered to this release, and the discard directly follows its skip.
        const deliver = r.trace.find(o => o.kind === 'deliver' && o.message === d.message)!;
        const skip = r.trace.find(o => o.kind === 'skip' && o.activation === d.activation)!;
        assert.ok(deliver.ordinal < skip.ordinal && skip.ordinal + 1 === d.ordinal);
    }
    // The input was consumed at release: every message was delivered once, and none stays queued.
    assert.equal(kinds(r.trace, 'deliver').length, 4);
});

test('WP7-R06 WP7-T02 a failing guard is an uncaught failure of the release, sourced at the entry or the failing callee statement: no successor, lock released, grid kept', async () => {
    const direct = await runClocked('', 'on every 10ms slot() when (100 % d > 1); after slot next(); on every 10ms toggle();', 31_000_000);
    const failures = kinds(direct.trace, 'failure');
    assert.deepEqual(failures.map(o => [ms(o), o.subject, o.source, o.reason]), [10, 20, 30].map(t => [t, 'c.slot', 'Test::C/schedule/0', 'Arithmetic']));
    assert.equal(kinds(direct.trace, 'skip').length, 0);
    assert.equal(direct.stores.c.nexts, 0, 'no after successor is released');
    assert.ok(!direct.trace.some(o => o.kind === 'release' && o.subject === 'c.next'));
    assert.equal(direct.stores.c.toggles, 3, 'the serial lock is released');
    assert.equal(direct.outcome, 'failure-observed');
    // Through a callee the failure names the callee's failing statement, exactly as for an argument that calls it.
    const callee = await runClocked('', 'on every 10ms slot() when (ratio() > 1) deadline 1ms;', 11_000_000);
    assert.deepEqual(kinds(callee.trace, 'failure').map(o => [o.source, o.reason]), [['Test::C.ratio/1', 'Arithmetic']]);
    assert.equal(callee.status, 'horizon', 'the deadline is cancelled');
    assert.equal(callee.stores.c.runs, 0);
    const argument = await runClocked('operation par(n: int) { }', 'on every 10ms par(ratio()) when (true);', 11_000_000);
    assert.deepEqual(kinds(argument.trace, 'failure').map(o => [o.source, o.reason]), [['Test::C.ratio/1', 'Arithmetic']]);
});

test('WP7-R01 WP7-R02 the guard is evaluated before the dispatch arguments: a false guard evaluates none, and a guard protects its arguments', async () => {
    // A guard protects its own arguments: the division is never evaluated while the divisor is zero.
    const members = 'operation par(n: int) { runs = runs + 1; } operation bump() returns int { lasts = lasts + 1; return 1; }';
    const guarded = await runClocked(members, 'on every 10ms par(100 % d) when (d != 0);', 31_000_000);
    assert.deepEqual([kinds(guarded.trace, 'failure').length, kinds(guarded.trace, 'skip').length, guarded.outcome], [0, 3, 'no-failure-observed']);
    // A false guard evaluates no argument: a helper that writes in an argument never runs on a skipped release.
    const skipped = await runClocked(members, 'on every 10ms par(bump()) when (toggles > 100);', 31_000_000);
    assert.deepEqual([skipped.stores.c.lasts, skipped.stores.c.runs, kinds(skipped.trace, 'skip').length], [0, 0, 3]);
    assert.ok(!skipped.trace.some(o => o.kind === 'write' && o.subject === 'c.lasts'));
    // A true guard evaluates the arguments next, and an argument failure keeps its 2.2 meaning: a failure of the release.
    const args = await runClocked(members, 'on every 10ms par(100 % d) when (d == 0);', 11_000_000);
    assert.deepEqual(kinds(args.trace, 'failure').map(o => [o.reason, o.source]), [['Arithmetic', 'Test::C/schedule/0']]);
    assert.equal(kinds(args.trace, 'skip').length, 0);
    const ran = await runClocked(members, 'on every 10ms par(bump()) when (toggles < 100);', 21_000_000);
    assert.deepEqual([ran.stores.c.lasts, ran.stores.c.runs], [2, 2]);
    // toggle runs first at each instant; the serial guard reads its write.
    const serial = await runClocked('', 'on every 10ms toggle(); on every 10ms slot() when (toggles % 2 == 0);', 41_000_000);
    assert.deepEqual(line(serial.trace, 'c.slot'), ['10 skip', '20 complete', '30 skip', '40 complete']);
});

test('WP7-R01 a concurrent entry reads attributes from its dispatch snapshot, not the live store', async () => {
    const source = `package Test {
  component def C { attribute awake: bool = true; attribute flips: uint = 0;
    operation three() returns int { var x: int = 1; x = x + 1; return x + 1; }
    operation peek(n: int) { }
    operation flip() { awake = not awake; flips = flips + 1; }
    schedule { on every 10ms peek(1) when (three() > 0 and awake) concurrent; on every 10ms flip(); }
  }
  component c: C;
}`;
    const r = simulate([(await valid(source)).model], 'Test::c', { untilNs: 41_000_000 });
    // flip writes awake while the guard's helper runs, before the guard reads awake; the guard reads the value at
    // dispatch (true at 10 ms, false at 20 ms).
    const write = r.trace.find(o => o.kind === 'write' && o.subject === 'c.awake')!, done = r.trace.find(o => o.subject === 'c.peek' && ['skip', 'complete'].includes(o.kind))!;
    assert.ok(write.ordinal < done.ordinal && write.timeNs === done.timeNs, 'the live value changed before the guard step');
    assert.deepEqual(line(r.trace, 'c.peek'), ['10 complete', '20 skip', '30 complete', '40 skip']);
});

test('WP7-R01 WP6-S01 a guard reads sample cells: the latest value delivered before its step, stable with the body within the segment', async () => {
    const r = await run(model('operation look() { if (mode.current == PowerMode.sleep) { last = last + 100; } runs = runs + 1; }', 'on every 5ms look() when (mode.current != PowerMode.sleep);'), 66_000_000);
    // Src sends sleep at 30 ms and 60 ms (k = 3, 6) and run at the other ticks, in the third step of its tick. c's guard
    // at 30 ms runs at its first step, before that send in the instant's event order, so it still sees run; the guards
    // at 35 and 40 ms see sleep (the send at 40 ms is again ordered after the guard), and those at 65 ms too.
    assert.deepEqual(at(r.trace, 'Demo.c.look', 'skip').map(([t]) => t), [35, 40, 65]);
    const send30 = r.trace.find(o => o.kind === 'sample' && o.timeNs === 30_000_000)!, look30 = r.trace.find(o => o.subject === 'Demo.c.look' && o.kind === 'complete' && o.timeNs === 30_000_000)!;
    const dispatch30 = r.trace.find(o => o.kind === 'dispatch' && o.activation === look30.activation)!;
    assert.ok(dispatch30.ordinal < send30.ordinal, 'the guard step precedes the update at 30 ms');
    assert.equal(r.stores['Demo.c'].last, 0, 'the body never sees a value the guard did not');
    const c = (await valid(model('', 'on every 5ms slot() when (mode.current != PowerMode.sleep);'))).model.packages[0].elements.filter(a.isComponentDef).find(x => x.name === 'C')!;
    assert.deepEqual(sampledMembers(c), new Set(['mode.current']));
    // A guard that samples beside a 2.2 receive owner of the same member is valid, as for any sampled read (WP6-S04).
    await valid(model('operation onMode(p: PowerMode) { }', 'on every 5ms slot() when (mode.current == PowerMode.run); on receive mode.current(p) onMode(p);'));
});

test('WP7-R01 WP6-R03 the guard, the arguments and the body read one sampled value even when a delivery falls between the guard step and the body', async () => {
    // C is dispatched before Src at each instant, so Src's send of the new mode is delivered after C's guard step and
    // before the later steps of look; a segment that dropped the guard's copy would let the body see the new value.
    const source = (guard: string) => `package Test {
  enum PowerMode { run, sleep }
  port def Mode { provides attribute current: PowerMode = PowerMode.run; }
  component def Src { port mode: Mode; attribute k: int = 0; operation tick() { send mode.current(if (k % 2 == 0) PowerMode.sleep else PowerMode.run); k = k + 1; } schedule { on every 10ms tick(); } }
  component def C { reversed port mode: Mode; attribute runs: uint = 0; attribute seen: uint = 0; attribute differ: uint = 0;
    operation awake() returns bool { return mode.current != PowerMode.sleep; }
    operation look(p: PowerMode) { runs = runs + 1; runs = runs + 1; runs = runs + 1; if (mode.current == PowerMode.sleep) { seen = seen + 1; } if (p != mode.current) { differ = differ + 1; } }
    schedule { on every 10ms look(mode.current) when (${guard}); }
  }
  component Demo { component c: C; component s: Src; connect (s.mode, c.mode); }
}`;
    for (const guard of ['mode.current != PowerMode.sleep', 'awake()']) {
        const r = simulate([(await valid(source(guard))).model], 'Test::Demo', { untilNs: 45_000_000 });
        const looks = r.trace.filter(o => o.subject === 'Demo.c.look' && ['complete', 'skip'].includes(o.kind));
        assert.deepEqual(looks.map(o => [ms(o), o.kind]), [[10, 'complete'], [20, 'skip'], [30, 'complete'], [40, 'skip']], guard);
        // The interleaving happens: a sample update of c's cell lies between a completed look's dispatch and its completion.
        const interleaved = looks.filter(o => o.kind === 'complete').some(done => {
            const dispatch = r.trace.find(o => o.kind === 'dispatch' && o.activation === done.activation)!;
            return r.trace.some(o => o.kind === 'sample' && o.ordinal > dispatch.ordinal && o.ordinal < done.ordinal);
        });
        assert.ok(interleaved, guard);
        assert.deepEqual([r.stores['Demo.c'].seen, r.stores['Demo.c'].differ], [0, 0], `${guard}: the body and the argument see what the guard saw`);
    }
});

test('WP7-R07 a skipped release neither fails nor completes a case; a failing guard fails it', async () => {
    const source = `package Test {
  import Swaml::Time;
  component def C { attribute runs: uint = 0;
    operation slot() { runs = runs + 1; }
    schedule { on every 10ms slot() when (now() % 30ms != 0); }
  }
  component c: C;
  test 'Skips pass' of c { wait 35ms; assert c.runs == 2; }
}
package Failing {
  component def F { attribute runs: int = 0;
    operation slot() { runs = runs + 1; }
    schedule { on every 10ms slot() when (10 % (2 - runs) >= 0); }
  }
  component f: F;
  test 'Guard failure fails' of f { wait 35ms; assert f.runs == 2; }
}`;
    const { model: m } = await valid(source);
    const results = runTests([m], { untilNs: 100_000_000 });
    assert.deepEqual(results.map(x => [x.case, x.result, x.reason ?? '', x.source ?? '']), [['Test::Skips pass', 'pass', '', ''], ['Failing::Guard failure fails', 'fail', 'run-failure', 'Failing::F/schedule/0']]);
    assert.equal(results[1].timeNs, 30_000_000);
    assert.match(String(results[1].message), /Arithmetic|Division by zero/u);
});

test('WP7-M01 projection shows release guards on their entries and Timing marks skips; nothing changes without a guard', async () => {
    const { model: m } = await valid(model('', 'on every 10ms slot() when (awake  and   runs<3) deadline 2ms; after slot next(); on receive inp.go(v) take(v) when (v > 0);'));
    const node = projectModel([m]).nodes.find(n => n.id === 'Test::C')!;
    assert.deepEqual(node.schedule!.map(e => [e.trigger, e.guard]), [['every', 'awake and runs < 3'], ['after slot', undefined], ['receive inp.go', 'v > 0']]);
    assert.ok(!('guard' in node.schedule![1]));
    const r = await runClocked('', 'on every 10ms slot() when (now() % 20ms != 0);', 21_000_000);
    const timing = projectOperationTiming(r);
    const skip = kinds(r.trace, 'skip')[0];
    assert.ok(timing.markers.some(o => o.kind === 'skip' && o.activation === skip.activation));
    assert.ok(timing.intervals.filter(i => i.activation === skip.activation).every(i => i.endNs === skip.timeNs));
});

test('WP7-M03 the formatter prints a release guard between the operation call and deadline', async () => {
    const services = createSwamlServices(EmptyFileSystem);
    const source = clocked('', 'on every 10ms slot()when(now()% 30ms!=0)deadline 2ms;\n      after slot   next( )  when ( runs>1 ) ;');
    const doc = await parseHelper<Model>(services.Swaml)(source);
    const formatted = formatDocument(doc as never);
    assert.match(formatted, /on every 10ms slot\(\) when \(now\(\) % 30ms != 0\) deadline 2ms;/u);
    assert.match(formatted, /after slot next\(\) when \(runs > 1\);/u);
    const again = await parseHelper<Model>(services.Swaml)(formatted);
    assert.equal(formatDocument(again as never), formatted, 'idempotent');
});

test('WP7-G01 an unfinished release guard validates, projects, indexes and builds view candidates without throwing, alone and beside a valid file', async () => {
    const other = 'package V { import Test; component def D specializes C { } }';
    for (const guard of ['when (', 'when ()', 'when (awake', 'when awake)', 'when', 'when (awake and)', 'when (awake) deadline', 'when (awake) when (awake)', 'when (inp.', 'when (mode.current !=']) {
        const source = model('', `on every 10ms slot() ${guard}; after slot next() when (awake);`);
        const r = await parse(source);
        assert.ok(r.doc.parseResult.parserErrors.length, guard);
        projectModel([r.model]);
        viewCandidates([r.model]);
        semanticIndex([r.model]);
        assert.throws(() => simulate([r.model], 'Test::Demo', { untilNs: 1_000_000 }), (e: Error) => !(e instanceof TypeError), guard);
        assert.throws(() => formatDocument(r.doc as never), /Fix syntax errors/u, guard);
        const both = await workspace([source, other]);
        const models = both.docs.map(d => d.parseResult.value as Model);
        projectModel(models);
        viewCandidates(models);
        semanticIndex(models);
        assert.deepEqual((both.docs[1].diagnostics ?? []).filter(x => x.severity === 1).map(x => x.code), [], `${guard}: the valid file`);
    }
});

test('WP7-S02 rename and references cover attributes, bindings and sampled ports read by a release guard', async () => {
    const source = model('', 'on every 10ms slot() when (awake and mode.current != PowerMode.sleep); on receive inp.go(v) take(v) when (v > 0);');
    const { model: m } = await valid(source);
    const refs = semanticIndex([m]).filter(x => !x.declaration);
    const lines = source.split('\n');
    const guardLine = lines.findIndex(l => l.includes('when ('));
    const inGuard = (name: string) => refs.filter(x => x.symbol.name === name && x.range.start.line === guardLine).map(x => lines[guardLine].slice(x.range.start.character, x.range.end.character));
    assert.deepEqual(inGuard('awake'), ['awake']);
    assert.deepEqual(inGuard('v'), ['v', 'v'], 'the argument and the guard');
    assert.deepEqual(inGuard('mode'), ['mode']);
    assert.deepEqual(inGuard('current'), ['current']);
});

test('WP7 examples: release guards in the LinMaster and ComMain shapes run their cases', async () => {
    for (const file of ['examples/50-lin-master-mode-gating.swaml', 'examples/51-com-main-release-guard.swaml']) {
        const text = readFileSync(new URL(file, root), 'utf8');
        const { model: m } = await valid(text);
        const results = runTests([m], { untilNs: 10_000_000_000 });
        assert.ok(results.length >= 3, file);
        assert.deepEqual(results.filter(x => x.result !== 'pass').map(x => [x.case, x.result, x.message]), [], file);
    }
});

test('WP7 determinism: repeated runs give identical traces', async () => {
    const { model: m } = await valid(model('operation look() { runs = runs + 1; }', 'on every 5ms look() when (mode.current != PowerMode.sleep) deadline 1ms; after look next() when (runs % 2 == 0); on receive inp.go(v) take(v) when (v % 2 == 0);'));
    const first = JSON.stringify(simulate([m], 'Test::Demo', { untilNs: 100_000_000 })), second = JSON.stringify(simulate([m], 'Test::Demo', { untilNs: 100_000_000 }));
    assert.equal(first, second);
});

test('WP7-S02 WP6-D02 an inherited guard that samples: a port redefinition dropping the initial value is reported once, at the redefinition', async () => {
    const source = (derived: string) => `package Test {
  port def D23 { provides attribute ajar: bool = false; }
  port def D22 { provides attribute ajar: bool; }
  component def Sensor22 { port out: D22; operation tick() { send out.ajar(true); } schedule { on every 10ms tick(); } }
  component def SA { reversed port door: D23; attribute runs: uint = 0; operation take() { runs = runs + 1; } schedule { on every 10ms take() when (not door.ajar); } }
  ${derived}
  component Demo { component s: Sensor22; component r: SAD; connect (s.out, r.door); }
}`;
    assert.deepEqual(await errors(source('component def SAD specializes SA { redefines reversed port door: D22; }')),
        [['SW2004', 'Sampled attribute ajar of D22 needs an initial value: an inherited schedule entry samples door.ajar.']]);
    // A derived entry that replaces the guarded one no longer samples, so the redefinition is valid and the member keeps one owner.
    assert.deepEqual(await errors(source('component def SAD specializes SA { redefines reversed port door: D22; operation got(v: bool) { } schedule { on every 10ms take(); on receive door.ajar(v) got(v); } }')), []);
});
