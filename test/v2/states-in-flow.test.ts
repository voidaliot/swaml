// States in the flow, package 2a (docs/proposals/STATES_IN_FLOW_PROPOSAL.md): flat waiting machines and the rules they
// run by. SIF-G01, SIF-S01 to SIF-S08 (SIF-D01 to SIF-D03), SIF-R01 to SIF-R06, SIF-R09, SIF-R10, SIF-R12, SIF-R13,
// SIF-T01, SIF-T02, SIF-T04, SIF-T08. Each runtime case names the mutation of the plan's package 2a it kills.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { AstUtils, EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { isShortBody, statementIdentity } from '../../src/language/semantic.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { viewCandidates } from '../../src/language/presentation.js';
import { simulate, type SimulationResult } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parseSample, runSample, sampleModel, traceLines, type Sample } from './states-flow-harness.js';
import { parse, workspace } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };

/** A controller with a port p of events m(v: uint), n() and k(), a port o with event out(v: uint), and attributes x, y, z. */
const machine = (control: string, extra: Partial<Sample> = {}): Sample => ({
    pkg: 'Flow', entry: 'run', control,
    // Only the members the text uses: every input needs one owner, every output an emitter.
    ports: { p: [['m', 'requires event m(v: uint)'], ['n', 'requires event n()'], ['k', 'requires event k()']].filter(([m]) => control.includes(`p.${m}(`)).map(([, d]) => d) },
    attributes: 'attribute x: uint = 0; attribute y: uint = 0; attribute z: uint = 0;', ...extra,
});
/** Runs a driver script against a controller; the result, its controller store and the printed lines. */
async function drive(s: Sample, script: string, untilNs = 1e9) {
    const p = await parseSample(sampleModel(s, script));
    assert.deepEqual(p.errors.map(e => e.message), [], 'model is valid');
    const r = simulate([p.model], s.pkg, { untilNs, maxSteps: 200000 });
    return { r, store: r.stores['c'] as Record<string, unknown>, lines: traceLines(r, s), trace: r.trace as Observation[] };
}
const errorsOf = async (control: string, extra: Partial<Sample> = {}, script = '') => (await parseSample(sampleModel(machine(control, extra), script))).errors.map(e => String(e.message));

// ---------------------------------------------------------------- grammar and identities (SIF-G01, SIF-S08)

test('SIF-G01 SIF-S08 the short form builds the same block as braces: same identities, only the concrete syntax differs', async () => {
    const body = (short: boolean) => `run() {
  state s {
    after 1ms ${short ? 'exit;' : '{ exit; }'}
    on receive p.n() ${short ? 'to t;' : '{ to t; }'}
    if (x > 0) ${short ? 'exit;' : '{ exit; }'} else ${short ? 'to t;' : '{ to t; }'}
  }
  state t { on receive p.k() exit; }
}`;
    const ids = async (short: boolean) => {
        const p = await parseSample(sampleModel(machine(body(short)), ''));
        assert.deepEqual(p.errors.map(e => e.message), []);
        const leaves = AstUtils.streamAllContents(p.model).filter(n => a.isExit(n) || a.isJump(n)).toArray();
        return { ids: leaves.map(n => statementIdentity(n)), short: leaves.map(n => isShortBody(n.$container as a.Block)) };
    };
    const short = await ids(true), braced = await ids(false);
    assert.deepEqual(short.ids, braced.ids);
    assert.deepEqual(short.ids.slice(0, 4), ['Flow::Controller.run/0/0/body/0', 'Flow::Controller.run/0/1/body/0', 'Flow::Controller.run/0/2/then/0', 'Flow::Controller.run/0/2/otherwise/0']);
    assert.deepEqual(short.short.slice(0, 4), [true, true, true, true]);
    assert.deepEqual(braced.short.slice(0, 4), [false, false, false, false]);
});

test('SIF-S08 a body without braces is only exit; or to S;: anything else is a syntax error with the block message and one hint', async () => {
    for (const text of ['after 1ms x = 1;', 'on receive p.n() x = 1;', 'if (x > 0) x = 1;', 'on receive p.m(v) if (v > 0) exit;']) {
        const r = await parse(sampleModel(machine(`run() { state s { ${text} } }`), ''));
        const message = r.doc.parseResult.parserErrors[0]?.message ?? '';
        assert.match(message, /^Expecting token of type '\{'/u, text);
        assert.match(message, /Only exit; and to S; may be written without braces\./u, text);
    }
});

// ---------------------------------------------------------------- static rules (SIF-S01 to SIF-S07; SIF-D01 to SIF-D03)

test('SIF-S01 SIF-D01 an operation with states is released by exactly one on start entry here, never called, never by another entry kind', async () => {
    const controller = (entries: string, more = '') => `package Flow {
  port def P { provides event m(v: uint); provides operation q() returns uint; }
  component def C { reversed port p: P; attribute x: uint = 0;
    operation run() { state s { on receive p.m(v) { x = v; exit; } } }
    operation other() { ${more} }
    schedule { ${entries} }
  }
}`;
    const messages = async (entries: string, more = '') => (await parse(controller(entries, more))).errors.map(e => String(e.message));
    assert.ok((await messages('on receive p.m(v) run();')).some(m => m.startsWith('run contains states, so it keeps its place and can only be released by one on start or one on every entry. To react to p.m, write on receive p.m(…) { … } in its states.')));
    assert.ok((await messages('on start other(); after other run();')).some(m => m.includes('To start after other, release run on start and let its first state wait for a value that other sets.')));
    assert.ok((await messages('on call p.q() run();')).some(m => m.includes('An operation with states cannot answer calls; answer in a plain operation and let it set an attribute that a state reads.')));
    assert.ok((await messages('on start other();')).some(m => m === 'run contains states, so it keeps its place and needs exactly one on start or one on every entry, not concurrent (SIF-S01).'));
    assert.ok((await messages('on start run(); on start run();')).length > 0);
    assert.ok((await messages('on start run() concurrent;')).some(m => m.startsWith('run contains states, so it keeps its place and needs exactly one')));
    assert.ok((await messages('on start run(); on start other();', 'run();')).some(m => m.startsWith('run contains states, so it keeps its place and is released only by its schedule entry; it is never called')));
    assert.deepEqual(await messages('on start run(); on start other();'), []);
});

test('SIF-S01 an operation with states is parameterless void and contains no plain receive statement or interrupt region; cases contain no states', async () => {
    assert.ok((await errorsOf('run() { state s { on receive p.n() exit; } on receive p.k() { } }')).some(m => m.startsWith('An operation with states contains no plain receive statement')));
    assert.ok((await errorsOf('run() { state s { on receive p.n() exit; } interruptible { x = 1; } on receive p.k() { } }')).some(m => m.startsWith('An operation with states contains no interrupt region')));
    const withParameter = sampleModel(machine('run() { state s { on receive p.n() exit; } }'), '').replace('operation run()', 'operation run(a: uint)').replace('on start run();', 'on start run(1);');
    assert.ok((await parse(withParameter)).errors.some(e => e.message === 'run contains states, so it is parameterless and returns void (SIF-S01).'));
    const scripted = `package Flow { port def P { provides event n(); } component def C { port p: P; operation e() { publish p.n(); } schedule { on start e(); } } component c: C; test t of c { state s { exit; } } }`;
    assert.ok((await parse(scripted)).errors.some(e => e.message === 'Case scripts contain no states (SIF-S01).'));
});

test('SIF-S02 SIF-S03 SIF-D03 one on entry and one on exit, items before inner states, state names unique in the operation', async () => {
    assert.ok((await errorsOf('run() { state s { on entry { } on entry { } on receive p.n() exit; } }')).includes('Duplicate on entry in s (SIF-S02).'));
    assert.ok((await errorsOf('run() { state s { on exit { } on exit { } on receive p.n() exit; } }')).includes('Duplicate on exit in s (SIF-S02).'));
    assert.ok((await errorsOf('run() { state s { state i { on receive p.n() exit; } x = 1; } }')).includes('s has inner states; only states may follow the first one (SIF-S03).'));
    assert.ok((await errorsOf('run() { state s { on receive p.n() exit; } state s { on receive p.k() exit; } }')).includes('Two states are named s in run (SIF-S02).'));
    assert.ok((await errorsOf('run() { state s { on receive p.n() exit; state i { on receive p.k() exit; } } state i { } }')).includes('Two states are named i in run (SIF-S02).'));
});

test('SIF-S04 SIF-D02 exit; and to S; stand only in a state\'s braces, their if blocks or an event line block; a state stands in the flow or directly in a parent', async () => {
    const outside = await errorsOf('run() { state s { on receive p.n() exit; } exit; }');
    assert.ok(outside.includes('exit leaves a state and stands only inside a state\'s braces (SIF-S04).'), outside.join('\n'));
    for (const where of ['on entry { exit; }', 'on exit { exit; }', 'while (x < 3) { exit; }', 'for (i: uint in [1, 2]) { to s; }'])
        assert.ok((await errorsOf(`run() { state s { ${where} on receive p.n() exit; } }`)).some(m => m.includes('cannot stand in on entry, on exit, a loop body or an interrupt region')), where);
    assert.ok((await errorsOf('run() { state s { on receive p.n() { if (x > 0) { exit; } else { to s; } } } }')).length === 0);
    assert.ok((await errorsOf('run() { state s { on receive p.n() { state t { } } } }')).some(m => m.startsWith('State t stands in the flow or directly in a parent\'s braces')));
    // A state in on entry is not even parsed as one (the parser stops the block at state); either way it is an error.
    assert.ok((await errorsOf('run() { state s { on entry { state t { } } on receive p.n() exit; } }')).length > 0);
    assert.ok((await errorsOf('run() { state s { if (x > 0) { state t { } } on receive p.n() exit; } }')).some(m => m.startsWith('State t stands in the flow')));
    assert.ok((await errorsOf('run() { state s { on receive p.n() { return; } } }')).includes('return does not stand in a state; leave the state with exit; and return after it (SIF-S04).'));
    // return in the flow outside states is allowed.
    assert.deepEqual(await errorsOf('run() { state s { on receive p.n() exit; } if (x > 0) { return; } state t { on receive p.k() exit; } }'), []);
});

test('SIF-S06 SIF-D02 a jump names a state of an enclosing list or inside parents standing in one, never in an if branch or a loop, never over a used declaration', async () => {
    assert.deepEqual(await errorsOf('run() { state a { on receive p.n() to c; } if (x > 0) { state b { on receive p.n() to a; } } state c { on receive p.k() to a; } }'), []);
    assert.ok((await errorsOf('run() { state a { on receive p.n() to b; } if (x > 0) { state b { on receive p.k() exit; } } }')).some(m => m.startsWith('to b: no state b in this list, an enclosing one, or inside a parent standing in one; a jump never enters an if branch or a loop (SIF-S06).')));
    assert.ok((await errorsOf('run() { state a { on receive p.n() to b; } while (x < 3) { state b { on receive p.k() exit; } } }')).some(m => m.startsWith('to b: no state b')));
    assert.ok((await errorsOf('run() { state a { on receive p.n() to nowhere; } }')).some(m => m.startsWith('to nowhere: no state nowhere')));
    // Direct entry into an inner state of a parent standing in the list.
    assert.deepEqual(await errorsOf('run() { state a { on receive p.n() to i2; } state b { on receive p.k() exit; state i1 { on receive p.n() exit; } state i2 { on receive p.n() exit; } } }'), []);
    assert.ok((await errorsOf('run() { state a { on receive p.n() to c; } var w: uint = 1; state c { on entry { x = w; } on receive p.k() exit; } }')).includes('`to c` skips the declaration of `w`, which `c` uses. Declare `w` before the jump (SIF-S06).'));
    assert.deepEqual(await errorsOf('run() { state a { on receive p.n() to c; } var w: uint = 1; state c { on receive p.k() exit; } }'), []);
});

test('SIF-S07 an event line\'s bindings are visible in its block only; on receive names events and attributes only', async () => {
    assert.ok((await errorsOf('run() { state s { on receive p.m(v) { x = v; } x = v; on receive p.n() exit; } }')).length > 0);
    assert.deepEqual(await errorsOf('run() { state s { on receive p.m(v) { x = v; exit; } } }'), []);
    const request = sampleModel(machine('run() { state s { on receive p.q() exit; } }', { ports: { p: ['requires operation q() returns uint', 'requires event n()'] } }), '');
    assert.ok((await parse(request)).errors.some(e => e.message === 'Input needs the matching owned member direction/kind.'));
});

// ---------------------------------------------------------------- runtime (SIF-R01 to SIF-R06, SIF-R09, SIF-R10, SIF-R12, SIF-R13)

test('SIF-R02 a look walks the items in written order; an event line runs at its place when its event is present; every statement runs at every look', async () => {
    // Kills: walk order reversed within a level; a statement skipped at a message look.
    const s = machine('run() { state s { x = x * 10 + 1; on receive p.n() { x = x * 10 + 2; } x = x * 10 + 3; after 5ms { x = x * 10 + 4; } on receive p.k() exit; } }');
    const { store } = await drive(s, 'wait 1ms; publish p.n(); wait 9ms; publish p.k();');
    // Arrival 13; n: 13 -> 131 -> 1312 -> 13123; 5 ms timer: 1312313 -> 13123134; k: 131231341 -> 1312313413.
    assert.equal(store.x, 1312313413);
});

test('SIF-R02 SIF-R09 a look ends at the first leave it runs; on exit runs after the leave\'s block, before the next state\'s entry', async () => {
    // Kills: look continuing after a leave; on exit before the leave's block.
    const s = machine('run() { state s { on exit { x = x * 10 + 2; } on receive p.n() { x = x * 10 + 1; exit; } y = y + 1; } state t { on entry { x = x * 10 + 3; } on receive p.k() exit; } }');
    const { store } = await drive(s, 'publish p.n();');
    assert.equal(store.x, 123);
    assert.equal(store.y, 1, 'the statement after the line ran at the arrival look only');
});

test('SIF-R01 SIF-R05 input that arrives while on entry suspends stays queued; the first wait takes it in zero time', async () => {
    // Kills: dropping input while busy.
    const s = machine('run() { state s { on entry { wait 10ms; } on receive p.m(v) { x = v; exit; } } }');
    const { store, trace } = await drive(s, 'wait 5ms; publish p.m(7);');
    assert.equal(store.x, 7);
    assert.equal(trace.find(o => o.kind === 'complete' && o.subject === 'c.run')?.timeNs, 10e6);
});

test('SIF-R03 a timer is present at exactly one look per arrival of its state, counted from that arrival', async () => {
    // Kills: a timer present twice per arrival.
    const s = machine('run() { state s { after 5ms { x = x + 1; } on receive p.n() { y = y + 1; } on receive p.k() to s; } }');
    const { store } = await drive(s, 'wait 6ms; publish p.n(); wait 1ms; publish p.k(); wait 2ms; publish p.n(); wait 10ms; publish p.n();', 30e6);
    // First arrival: the timer at 5 ms once, n at 6 ms adds no timer run; to s at 7 ms restarts it: once more at 12 ms.
    assert.equal(store.x, 2);
    assert.equal(store.y, 3);
});

test('SIF-R05 a timer that runs out at t is looked at in phase 1, before a delivery at t', async () => {
    // Kills: timer and delivery phases swapped.
    const s = machine('run() { state s { after 10ms { x = x * 10 + 1; } on receive p.n() { x = x * 10 + 2; } on receive p.k() exit; } }');
    const { store } = await drive(s, 'wait 10ms; publish p.n(); publish p.k();');
    assert.equal(store.x, 12);
});

test('SIF-R05 the zero-time wait picks the named message again at its event: a capacity-1 dropOldest overflow in between is respected', async () => {
    // Kills: re-pick replaced by the message picked when the wait began.
    const source = `package Flow {
  import Swaml::Qos;
  qos def One: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 1; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides event m(v: uint); }
  component def C { reversed port p: P; attribute x: uint = 0; attribute seen: uint = 0;
    operation run() { wait 5ms; state s { on entry { wait 5ms; } on receive p.m(v) { seen = seen + 1; x = v; } } }
    schedule { on start run(); }
  }
  component def D { port p: P; operation go() { publish p.m(1); wait 10ms; publish p.m(2); } schedule { on start go(); } }
  component c: C;
  component d: D;
  connect: One (d.p, c.p);
}`;
    const r = await parse(source);
    assert.deepEqual(r.errors.map(e => e.message), []);
    const result = simulate([r.model], 'Flow', { untilNs: 1e9 });
    assert.deepEqual(result.stores['c'], { x: 2, seen: 1 });
});

test('SIF-R06 SIF-T04 a taken message whose lines ran only false tests is noEnabledTransition; one taken by a look that left before its line is leftBeforeLine', async () => {
    // Kills: the two discard reasons swapped.
    const false_ = await drive(machine('run() { state s { on receive p.m(v) { if (v > 5) exit; } on receive p.k() exit; } }'), 'publish p.m(1);');
    assert.ok(false_.lines.includes('0ms discard c.run (noEnabledTransition)'), false_.lines.join('\n'));
    const before = await drive(machine('run() { state s { x = x + 1; if (x > 1) exit; on receive p.m(v) { y = v; } } }'), 'publish p.m(1);');
    assert.ok(before.lines.includes('0ms discard c.run (leftBeforeLine)'), before.lines.join('\n'));
    assert.equal(before.store.y, 0);
});

test('SIF-R05 SIF-R06 owned members not named at the waiting state are dropped (inactiveOwner): queued when the wait begins, and on arrival', async () => {
    const s = machine('run() { state a { on entry { wait 5ms; } on receive p.k() exit; } state b { on receive p.n() { x = x + 1; } on receive p.m(v) exit; } }');
    const { store, lines } = await drive(s, 'publish p.n(); publish p.k(); wait 10ms; publish p.n(); publish p.m(1);');
    // The n queued during a's entry is dropped when a begins to wait; b names n and counts the one at 10 ms.
    assert.equal(store.x, 1);
    assert.equal(lines.filter(l => l.includes('discard p.n (inactiveOwner)')).length, 1, lines.join('\n'));
    // In a, an n delivered while it waits is dropped on arrival too.
    const waiting = await drive(machine('run() { state a { on receive p.k() exit; } state b { on receive p.n() { x = x + 1; } } }'), 'wait 1ms; publish p.n(); wait 1ms; publish p.k(); publish p.n();');
    assert.equal(waiting.store.x, 1);
    assert.ok(waiting.lines.includes('1ms discard p.n (inactiveOwner)'), waiting.lines.join('\n'));
});

test('SIF-R01 SIF-R13 a state with nothing to look at is a named step; exit; from a state in the flow goes on with the next statement; completion discards later input', async () => {
    // Kills: named step that waits; exit; from a flow-level state not continuing with the next statement.
    const s = machine('run() { state a { on receive p.n() exit; } x = 1; state named { on entry { y = 1; } } z = 1; }');
    const { r, store, lines } = await drive(s, 'publish p.n(); wait 1ms; publish p.n();');
    assert.deepEqual([store.x, store.y, store.z], [1, 1, 1]);
    assert.ok(lines.includes('0ms run completes'), lines.join('\n'));
    assert.ok(lines.includes('1ms discard p.n (inactiveOwner)'), lines.join('\n'));
    assert.deepEqual(r.machines['c.run'], { state: 'named', live: false });
});

test('SIF-R09 SIF-R10 a jump out of loops ends them; a backward jump that passes a declaration runs it again', async () => {
    // Kills: backward jump not re-running a declaration.
    const s = machine('run() { state top { on receive p.n() exit; } var k: uint = 5; k = k + 1; x = x * 10 + k; state back { on receive p.n() to top; } }');
    const { store } = await drive(s, 'publish p.n(); wait 1ms; publish p.n(); wait 1ms; publish p.n(); wait 1ms; publish p.n();');
    assert.equal(store.x, 66);
    const loops = machine('run() { while (y < 10) { y = y + 1; for (i: uint in xs) { z = z + i; state inner { on receive p.n() to done; on receive p.k() exit; } } } state done { on entry { x = y * 100 + z; } } }');
    loops.attributes += ' attribute xs: uint[3] = [1, 2, 3];';
    const out = await drive(loops, 'publish p.k(); wait 1ms; publish p.k(); wait 1ms; publish p.n();');
    // Two k leave inner and continue the for (z = 1 + 2 + 3); n ends both loops at once: y stays 1.
    assert.equal(out.store.x, 106);
});

test('SIF-T01 SIF-T02 state observations: one per arrival with the leave that led there, a stay only when a present line acted and did not leave', async () => {
    const s = machine('run() { state a { on receive p.m(v) { if (v > 1) { x = v; } } on receive p.n() to b; } state b { on receive p.k() exit; } }');
    const { trace } = await drive(s, 'publish p.m(1); wait 1ms; publish p.m(2); wait 1ms; publish p.n();');
    const states = trace.filter(o => o.kind === 'state' && o.subject === 'c.run').map(o => [o.timeNs / 1e6, o.state, o.stay ?? false, o.trigger ?? '']);
    assert.deepEqual(states, [[0, 'a', false, ''], [1, 'a', true, 'Flow::Controller.run/0/0'], [2, 'b', false, 'Flow::Controller.run/0/1/body/0']].map(([t, n, stay, trig]) => stay ? [t, n, stay, ''] : [t, n, stay, trig]));
    assert.equal(trace.find(o => o.kind === 'state' && o.stay)?.source, 'Flow::Controller.run/0/0');
});

test('SIF-T08 a computed timer is evaluated once at arrival and recorded with its value', async () => {
    const s = machine('run() { state s { after (x * 1ms + 2ms) { y = 1; exit; } } }');
    const { trace, store } = await drive(s, '');
    const timer = trace.find(o => o.kind === 'timer');
    assert.deepEqual([timer?.timerNs, timer?.expiresNs, timer?.source], [2e6, 2e6, 'Flow::Controller.run/0/0']);
    assert.equal(store.y, 1);
});

test('SIF-R12 an if test in a state\'s braces is not a scheduling step: other activations of the instant interleave as with a 2.2 guard', async () => {
    // Kills: if test counted as a step. Two occurrences start at 0: d counts its steps while c's arrival look tests ten ifs.
    const source = (tests: string) => `package Flow {
  port def P { provides event n(); }
  component def C { reversed port p: P; attribute x: uint = 0; attribute y: uint = 0;
    operation run() { state s { ${tests} y = y + 1; on receive p.n() exit; } }
    schedule { on start run(); }
  }
  component def D { port p: P; attribute k: uint = 0; operation go() { k = k + 1; k = k + 1; k = k + 1; k = k + 1; k = k + 1; k = k + 1; publish p.n(); } schedule { on start go(); } }
  component c: C;
  component d: D;
  connect (d.p, c.p);
}`;
    const order = async (tests: string) => {
        const r = await parse(source(tests));
        assert.deepEqual(r.errors.map(e => e.message), []);
        return (simulate([r.model], 'Flow', { untilNs: 1e9 }).trace as Observation[]).filter(o => o.kind === 'write' || o.kind === 'state').map(o => `${o.kind} ${o.subject}`);
    };
    const tests = Array.from({ length: 3 }, () => 'if (x > 9) { x = 1; }').join(' ');
    assert.deepEqual(await order(tests), await order(''));
});

// The flow-state counterparts of WP5's internal transitions, guarded timers and completion (test/v2/state-reactions.test.ts).

test('SIF-R02 SIF-R03 a line that does not leave keeps the state and its timers; an if after it sees its write (WP5-R02, WP5-R05)', async () => {
    // Kills: a staying line restarting the timers; an if in the braces not checked again after a line.
    const s = machine('run() { state s { on receive p.m(v) { x = x + v; } if (x >= 3) exit; after 5ms { y = x; exit; } } }');
    const kept = await drive(s, 'wait 1ms; publish p.m(1); wait 3ms; publish p.m(1);');
    // m at 1 ms and 4 ms stay (x = 2); the timer counted from the arrival at 0 leaves at 5 ms.
    assert.deepEqual([kept.store.x, kept.store.y], [2, 2]);
    assert.equal(kept.trace.find(o => o.kind === 'complete' && o.subject === 'c.run')?.timeNs, 5e6);
    const left = await drive(s, 'wait 1ms; publish p.m(1); wait 1ms; publish p.m(2);');
    assert.deepEqual([left.store.x, left.store.y], [3, 0]);
    assert.equal(left.trace.find(o => o.kind === 'complete' && o.subject === 'c.run')?.timeNs, 2e6);
    // A computed timer is evaluated at the arrival only: a line that changes what it reads does not move it (WP4-R02).
    const computed = await drive(machine('run() { state s { after (x * 1ms + 2ms) { y = 1; exit; } on receive p.m(v) { x = x + v; } } }'), 'wait 1ms; publish p.m(5);');
    assert.deepEqual([computed.trace.filter(o => o.kind === 'timer').length, computed.trace.find(o => o.kind === 'complete' && o.subject === 'c.run')?.timeNs], [1, 2e6]);
});

test('SIF-R03 SIF-R09 a timer is a moment: an if in its block that is false consumes it for this arrival; equal timers run in written order (WP5-R04)', async () => {
    // Kills: a timer present again after a false test; equal timers out of written order.
    const equal = await drive(machine('run() { state s { after 1ms { if (y > 0) to b; } after 1ms { x = 1; exit; } } return; state b { on entry { x = 2; } } }'), '');
    assert.equal(equal.store.x, 1);
    const once = await drive(machine('run() { state s { on receive p.n() { y = 1; } after 1ms { if (y > 0) exit; } after 3ms { x = x + 1; to s; } } }'), 'wait 2ms; publish p.n();', 5e6);
    // The 1 ms timer was false at 1 ms and is not looked at again in this arrival; to s at 3 ms arrives again, and at 4 ms y is 1.
    assert.deepEqual([once.store.x, once.trace.find(o => o.kind === 'complete' && o.subject === 'c.run')?.timeNs], [1, 4e6]);
});

test('SIF-R05 SIF-R12 a look suspended in its line holds the state: when it begins to wait, a timer that ran out comes before input queued meanwhile (WP5-R06)', async () => {
    // Kills: queued input taken before an elapsed timer when a suspended look ends.
    const s = machine('run() { state s { on receive p.m(v) { wait 3ms; x = v; } after 2ms { y = 1; exit; } on receive p.n() { z = 1; exit; } } }');
    const { store, lines } = await drive(s, 'publish p.m(1); wait 1ms; publish p.n();');
    assert.deepEqual([store.x, store.y, store.z], [1, 1, 0]);
    assert.ok(lines.includes('3ms discard p.n (inactiveOwner)'), lines.join('\n'));
});

test('SIF-R01 SIF-R05 input queued during an entry is looked at by the first state that waits, after states whose arrival look leaves (WP5-R13)', async () => {
    // Kills: input dropped or taken while the flow passes states that leave at their arrival look.
    const chain = (end: string) => machine(`run() { state a { on entry { wait 1ms; y = 1; } if (y == 1) exit; } state b { on entry { y = 2; } if (y == 2) exit; } ${end} }`);
    const taken = await drive(chain('state c { on receive p.m(v) { x = v; exit; } }'), 'publish p.m(7);');
    assert.equal(taken.store.x, 7);
    // A first waiting state that does not name it drops it when it begins to wait.
    const dropped = await drive(chain('state c { after 1ms exit; } state d { on receive p.m(v) { x = v; exit; } }'), 'publish p.m(7);');
    assert.equal(dropped.store.x, 0);
    assert.ok(dropped.lines.includes('1ms discard p.m (inactiveOwner)'), dropped.lines.join('\n'));
});

test('SIF-R04 a look reads values as they are when it runs; what earlier items of the look wrote is seen by later items', async () => {
    const s = machine('run() { state s { var seen: uint = x; on receive p.m(v) { x = v + seen; } if (x > 10) exit; } }');
    const { store } = await drive(s, 'publish p.m(4); wait 1ms; publish p.m(20);');
    // m(4): seen 0, x = 4; m(20): seen 4, x = 24 > 10, the if after the line sees it and leaves.
    assert.equal(store.x, 24);
});

test('states in the flow: one machine per occurrence, also with a redefined operation in a derived definition', async () => {
    const source = `package Flow {
  port def P { provides event n(); }
  component def C { reversed port p: P; attribute x: uint = 0;
    operation run() { state s { on receive p.n() { x = x + 1; } } }
    schedule { on start run(); }
  }
  component def C2 specializes C { redefines operation run() { state s { on receive p.n() { x = x + 10; } } } }
  component def D { port p: P; port q: P; operation go() { publish p.n(); publish q.n(); } schedule { on start go(); } }
  component c: C;
  component c2: C2;
  component d: D;
  connect (d.p, c.p);
  connect (d.q, c2.p);
}`;
    const r = await parse(source);
    assert.deepEqual(r.errors.map(e => e.message), []);
    const result = simulate([r.model], 'Flow', { untilNs: 1e9 });
    assert.deepEqual([result.stores['c'].x, result.stores['c2'].x], [1, 10]);
    assert.deepEqual(Object.keys(result.machines).sort(), ['c.run', 'c2.run']);
});

// ---------------------------------------------------------------- tools: formatter, projection, semantic index, half-typed text

test('SIF-G01 the formatter prints states, event lines, short bodies and else if canonically and idempotently', async () => {
    const services = createSwamlServices(EmptyFileSystem);
    const source = sampleModel(machine('run() {   state s{on entry{x=1;}after 5ms exit;on receive p.m(v){if(v>1)to t;else if(v==0) exit;else{y=v;}}\n if (x>0)exit;}\nstate t{on receive p.n()  to s ;}}'), '');
    const doc = await parseHelper<Model>(services.Swaml)(source);
    const formatted = formatDocument(doc as never);
    assert.match(formatted, /\n {6}state s \{\n {8}on entry \{\n {10}x = 1;\n {8}\}\n {8}after 5ms exit;\n {8}on receive p\.m\(v\) \{\n {10}if \(v > 1\) to t;\n {10}else if \(v == 0\) exit;\n {10}else \{\n/u);
    assert.match(formatted, /\n {8}if \(x > 0\) exit;\n/u);
    assert.match(formatted, /\n {8}on receive p\.n\(\) to s;\n/u);
    const again = await parseHelper<Model>(services.Swaml)(formatted);
    assert.equal(formatDocument(again as never), formatted, 'idempotent');
});

test('SIF-G01 projection: states are view candidates of their operation; each to S is a transition edge labelled with what leads to it', async () => {
    const p = await parseSample(sampleModel(machine('run() { state a { on receive p.m(v) { if (v > 1) to b; } after 5ms to b; } state b { on receive p.n() to a; on receive p.k() exit; } }'), ''));
    assert.deepEqual(p.errors.map(e => e.message), []);
    const candidates = viewCandidates([p.model]).filter(c => c.kind === 'state').map(c => c.path);
    assert.ok(candidates.includes('Flow::c.run.a') && candidates.includes('Flow::c.run.b'), candidates.join(', '));
    const edges = projectModel([p.model]).edges.filter(e => e.kind === 'transition' && e.source.startsWith('Flow::c.run.')).map(e => [e.source, e.target, e.label, e.order]);
    assert.deepEqual(edges, [['Flow::c.run.a', 'Flow::c.run.b', 'p.m [v > 1]', 0], ['Flow::c.run.a', 'Flow::c.run.b', 'after 5ms', 1], ['Flow::c.run.b', 'Flow::c.run.a', 'p.n', 0]]);
    const refs = semanticIndex([p.model]);
    const b = refs.filter(r => r.symbol.name === 'b' && a.isStateStep(r.symbol.node));
    assert.ok(b.some(r => r.declaration) && b.filter(r => !r.declaration).length === 2, JSON.stringify(b.map(r => [r.symbol.key, r.declaration])));
});

test('SIF-G01 half-typed states validate, project, index, build view candidates, format-refuse and simulate-refuse without throwing', async () => {
    const other = 'package V { import Flow; }';
    for (const text of ['state', 'state s', 'state s {', 'state s { on receive p.m(v) }', 'state s { on receive p.m(v) if (v > 1) exit; }', 'state s { to }', 'state s { after }', 'state s { after 5ms }', 'state s { on entry }', 'state { exit; }', 'state s { exit }', 'state s { on receive }', 'state s { state }', 'to', 'exit', 'state s { if (x > 0) exit else to t; }']) {
        const source = sampleModel(machine(`run() { ${text} }`), '');
        const r = await parse(source);
        assert.ok(r.doc.parseResult.parserErrors.length, text);
        projectModel([r.model]);
        viewCandidates([r.model]);
        semanticIndex([r.model]);
        assert.throws(() => simulate([r.model], 'Flow', { untilNs: 1_000_000 }), (e: Error) => !(e instanceof TypeError), text);
        assert.throws(() => formatDocument(r.doc as never), /Fix syntax errors/u, text);
        const both = await workspace([source, other]);
        const models = both.docs.map(d => d.parseResult.value as Model);
        projectModel(models);
        viewCandidates(models);
        semanticIndex(models);
    }
});

test('SIF-R01 to SIF-R13 determinism: two runs of a reading sample give the same trace', async () => {
    const s = machine('run() { while (y < 3) { state a { on receive p.m(v) { x = x + v; exit; } after 2ms { y = y + 1; exit; } } } }');
    const once = async (): Promise<SimulationResult> => (await runSample(s, 'run', 'publish p.m(1); wait 3ms; publish p.m(2);', 1e9)).result!;
    const text = async () => JSON.stringify((await once()).trace).replace(/file:\/\/\/\d+\.swaml/gu, 'file');
    assert.ok(await text() === await text(), 'two runs give the same trace');
});

test('states in the flow: the Timing projection draws one state band per arrival, ending at the next arrival or the completion', async () => {
    const { projectOperationTiming } = await import('../../src/simulation/timing.js');
    const s = machine('run() { state a { on receive p.n() exit; } state b { after 3ms exit; } }');
    const { r } = await drive(s, 'wait 2ms; publish p.n();');
    assert.deepEqual(projectOperationTiming(r).states?.map(b => [b.state, b.startNs / 1e6, (b.endNs ?? -1) / 1e6]), [['a', 0, 2], ['b', 2, 5]]);
});
