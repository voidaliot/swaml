// States in the flow, package 4 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 3.7, 3.8, 3.17, 4.4, 4.5): values that wake a
// state and the machine's own writes. SIF-R07 (read sets per effective occurrence through helpers, redefinition
// and shadowing; wakes counted by writes at the writer's unlock, by case calls at every unlock, by sample-cell updates at
// their delivery; pending wakes), SIF-R08 (the own-write re-look, waiting machines only), zero-time loops ending at the
// step limit (StateLoop, SIF-R18 and SIF-D05 are cut), SIF-D04, SIF-T03 (wake) and reading sample 8. The fixture models are the interpreter
// prototype's (states-p7: p4-values, p4-stateloop, p7-own-writes, p4-antipinch-*); results and step counts are those of
// its recorded evidence. Each runtime case names the mutation of the plan's package 4 it kills (scripts/mutations-sif2.mjs).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { eachTest, type CaseResult } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import { parseSample, sampleModel, type Sample } from './states-flow-harness.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const fixtures = new URL('../../../test/fixtures/states-in-flow/', import.meta.url);

/** Every case of a model text, by case name; the model must be valid. */
async function cases(text: string, uri = 'file:///values.swaml'): Promise<Map<string, CaseResult>> {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(text, { documentUri: uri, validation: true });
    const errors = (document.diagnostics ?? []).filter(d => d.severity === 1).map(d => d.message);
    assert.deepEqual(errors, [], 'model is valid');
    return new Map([...eachTest([document.parseResult.value], { untilNs: 1e10, maxSteps: 200000 })].map(r => [r.case.slice(r.case.indexOf('::') + 2), r]));
}
const fixture = (file: string) => cases(readFileSync(new URL(file, fixtures), 'utf8'), `file:///${file}`);
const trace = (r: CaseResult | undefined): Observation[] => (r?.run?.trace ?? []) as Observation[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wakes = (r: CaseResult | undefined, subject?: string): Record<string, any>[] => trace(r).filter(e => e.kind === 'wake' && (!subject || e.subject === subject)).map(({ ordinal: _o, timeNs, kind: _k, activation: _a, ...e }) => ({ ms: timeNs / 1e6, ...e }));
const stateLines = (r: CaseResult | undefined, subject: string) => trace(r).filter(e => e.kind === 'state' && e.subject === subject).map(e => `${e.timeNs / 1e6}ms ${e.stay ? 'stay' : 'state'} ${e.state}`);
const pass = (r: CaseResult | undefined, what: string) => assert.equal(r?.result, 'pass', `${what}: ${r?.reason ?? ''} ${r?.message ?? ''}`);

/**
 * One component def M with an input port in (events go(), k(), m(v: uint)), attributes x, y, n (uint) and ready (bool), the
 * operation run() given, poke() released by in.go that writes x = value, and a test 'T' of an occurrence m with script.
 */
const unit = (run: string, script: string, poke = 'x = 0;') => `package Unit {
  port def In { provides event go(); provides event k(); provides event m(v: uint); }
  component def M {
    reversed port in: In;
    attribute x: uint = 0;
    attribute y: uint = 0;
    attribute n: uint = 0;
    attribute ready: bool = false;
    operation poke() { ${poke} }
    operation idle() { }
    operation ${run}
    schedule { on start run(); on receive in.go() poke(); ${['k', 'm'].filter(x => !run.includes(`in.${x}(`)).map(x => `on receive in.${x}(${x === 'm' ? 'v' : ''}) idle();`).join(' ')} }
  }
  component def Bench { port out: In; }
  component m: M;
  component bench: Bench;
  connect (bench.out, m.in);
  associate bench to 'T';
  test 'T' of m {
    ${script}
  }
}`;
const one = async (run: string, script: string, poke?: string) => (await cases(unit(run, script, poke))).get('T')!;

// ---------------------------------------------------------------- SIF-R07: read sets and wakes

test('SIF-R07 the prototype values cases: helpers, case calls, shadowing, redefinition per occurrence, a write while the look is suspended', async () => {
    const r = await fixture('p4-values.swaml');
    // Results and step counts of the recorded evidence (states-p7 p4-values-and-wakes.txt).
    const expected: Record<string, number> = { 'Own write after the line': 140, 'Own write before the line': 142, 'Helper read set, write by another activation': 178, 'Case call writes': 166, 'Case call suspended in the middle': 209, 'Shadowed attribute': 146, 'Redefinition per occurrence': 257, 'Write while the look is suspended': 183 };
    for (const [name, steps] of Object.entries(expected)) {
        pass(r.get(name), name);
        assert.equal(r.get(name)?.run?.steps, steps, `${name} steps`);
    }
    // A write by another activation wakes at its unlock, naming the writer and the attribute (SIF-T03).
    const helper = wakes(r.get('Helper read set, write by another activation'), 'heater.run');
    assert.deepEqual(helper.map(({ ms, cause, attributes, state }) => ({ ms, cause, attributes, state })), [{ ms: 0, cause: 'write', attributes: ['temp'], state: 'watching' }, { ms: 1, cause: 'write', attributes: ['temp'], state: 'watching' }]);
    assert.ok(helper.every(w => typeof w.writer === 'string' && w.pending === undefined));
    // A case call wakes at every unlock: at its suspension (temp 50) and at its return (temp 70).
    assert.deepEqual(wakes(r.get('Case call suspended in the middle'), 'heater.run').map(w => w.ms), [0, 10]);
    // A helper parameter named like the port hides the sampled member: its updates wake nothing.
    assert.deepEqual(wakes(r.get('Shadowed attribute'), 'shadowed.run'), []);
    // Kills D3 (read set ignoring redefinition): each occurrence wakes on the attribute its effective hot() reads.
    assert.deepEqual(wakes(r.get('Redefinition per occurrence')).map(w => [w.subject, w.attributes[0]]), [['base.run', 'a'], ['special.run', 'b'], ['usage.run', 'b']]);
    // Kills D4 (pending wake dropped): the write lands while the look is suspended in wait 5ms; it is served when the state
    // begins to wait, and recorded then with pending: true.
    assert.deepEqual(wakes(r.get('Write while the look is suspended'), 'busy.run').map(({ ms, cause, attributes, pending }) => ({ ms, cause, attributes, pending })), [{ ms: 5, cause: 'write', attributes: ['flag'], pending: true }]);
});

test('SIF-R07 wakes are writes, not changes: an equal value written by another activation makes a look (kills D1)', async () => {
    const r = await one(`run() {
      state s {
        y = y + 1;
        if (x > 5) exit;
        on receive in.k() exit;
      }
    }`, 'publish bench.out.go(); wait 1ms; publish bench.out.go(); wait 1ms; assert m.y == 3;');
    pass(r, 'equal writes');
    assert.deepEqual(wakes(r).map(w => [w.ms, w.cause, w.attributes]), [[0, 'write', ['x']], [1, 'write', ['x']]]);
});

test('SIF-R07 the read set holds the statements standing in the state, not its event lines or entry and exit (kills D2)', async () => {
    const r = await one(`run() {
      state s {
        on entry { y = x; }
        on exit { y = x; }
        on receive in.k() { if (x > 5) exit; }
        n = n + 1;
      }
    }`, 'publish bench.out.go(); wait 1ms; assert m.n == 1;', 'x = 9;');
    pass(r, 'no wake');
    assert.deepEqual(wakes(r), []);
});

test('SIF-R07 a parent\'s statements belong to the read set of the states inside it; a write to another attribute wakes nothing', async () => {
    const r = await one(`run() {
      state p {
        if (x > 5) to done;
        state s {
          y = y + 1;
          on receive in.k() exit;
        }
      }
      state done { on entry { n = 1; } }
    }`, 'publish bench.out.go(); wait 1ms; assert m.n == 1 and m.y == 1;', 'x = 9;');
    pass(r, 'parent condition');
    const other = await one(`run() {
      state s {
        if (y > 5) exit;
        n = n + 1;
        on receive in.k() exit;
      }
    }`, 'publish bench.out.go(); wait 1ms; assert m.n == 1;', 'x = 9;');
    pass(other, 'x is not read');
});

test('SIF-R05 step 3 the message picked when the wait begins is taken at its end; a delivery of the same instant is applied before the wait begins', async () => {
    // At 0 ms the k line runs and suspends 5 ms; at 2 ms another activation writes x (in the read set): a pending wake. At
    // 5 ms the line publishes m to the machine's own input (zero latency: a delivery event of this instant). That delivery
    // runs between the publish step and the end of the look, so when the state begins to wait m is queued: the zero-time
    // wait picks it, and one look serves the pending wake and m. This is the closest case to a delivery between the start
    // and the end of the zero-time wait, which cannot happen (the mutation "re-pick replaced by the picked message", A8,
    // is equivalent, so the rule takes the message picked when the wait begins).
    const r = (await cases(`package Repick {
  port def In { provides event k(); provides event go(); }
  port def Loop { provides event m(v: uint); }
  component def M {
    reversed port in: In;
    port out: Loop;
    reversed port back: Loop;
    attribute x: uint = 0;
    attribute y: uint = 0;
    attribute z: uint = 0;
    operation poke() { x = 1; }
    operation run() {
      state s {
        y = y + 1;
        if (x > 5) exit;
        on receive in.k() { wait 5ms; publish out.m(1); }
        on receive back.m(v) { z = z + v; }
      }
    }
    schedule { on start run(); on receive in.go() poke(); }
  }
  component def Bench { port out: In; }
  component m: M;
  component bench: Bench;
  connect (bench.out, m.in);
  connect (m.out, m.back);
  associate bench to 'T';
  test 'T' of m {
    publish bench.out.k();
    wait 2ms;
    publish bench.out.go();
    wait 10ms;
    assert m.y == 3 and m.z == 1;
  }
}`)).get('T');
    pass(r, 're-pick');
    // The look at 5 ms is a message look: the pending wake is served by it, so no wake is recorded.
    assert.deepEqual(wakes(r), []);
});

test('SIF-R05 SIF-R07 a delivery of a member the state both reads and names in a line makes one look, with the message, whether the machine was idle or busy (review 3 F3)', async () => {
    const line = await fixture('r3-sampled-line.swaml');
    pass(line.get('T'), 'one look per delivery');
    assert.deepEqual(wakes(line.get('T')), []);
    const r = await fixture('r3-sampled-idle-busy.swaml');
    for (const name of ['Idle', 'Busy']) {
        pass(r.get(name), name);
        // closing leaves before its line; the delivery stays queued and reversing takes it.
        assert.deepEqual(trace(r.get(name)).filter(e => e.kind === 'discardInput'), [], name);
        assert.deepEqual(wakes(r.get(name)), [], name);
    }
});

// ---------------------------------------------------------------- SIF-R08: the machine's own writes

test('SIF-R08 the prototype own-write cases: counter, timer, parent condition, an acting statement once more, statement writes', async () => {
    const r = await fixture('p7-own-writes.swaml');
    for (const name of ['Counter leaves at the third x', 'Own timer write', 'Parent condition and inner line', 'Alarm acts once more, not forever', 'Statement writes cause no look'])
        pass(r.get(name), name);
    // One re-look per message look whose line wrote what the condition read, with the names written (SIF-T03, cause own).
    assert.deepEqual(wakes(r.get('Counter leaves at the third x'), 'counter.run').map(w => [w.ms, w.cause, w.names]), [[0, 'own', ['n']], [1, 'own', ['n']], [2, 'own', ['n']]]);
    assert.deepEqual(wakes(r.get('Own timer write'), 'ownTimer.run').map(w => [w.ms, w.cause, w.names]), [[10, 'own', ['ready']]]);
    // Kills D5 (re-look also after statement writes): k counts looks; the third x leaves before its line, and the message stays queued.
    assert.deepEqual(wakes(r.get('Statement writes cause no look'), 'during.run'), []);
});

test('SIF-R08 only a statement written before the line looks again: a statement after it already saw the write (kills D6)', async () => {
    const r = await one(`run() {
      state s {
        on receive in.m(v) { n = v; }
        y = y + n;
        on receive in.k() exit;
      }
    }`, 'publish bench.out.m(4); wait 1ms; assert m.y == 4;');
    pass(r, 'statement after the line');
    assert.deepEqual(wakes(r), []);
    // A local of the flow counts as a name the machine reads; a local of the line's block or of the look does not.
    const local = await one(`run() {
      var seen: uint = 0;
      state s {
        var copy: uint = seen;
        if (seen > 1) exit;
        on receive in.m(v) { var t: uint = v; seen = t; copy = t; }
      }
      y = seen;
    }`, 'publish bench.out.m(2); wait 1ms; assert m.y == 2;');
    pass(local, 'flow local');
    assert.deepEqual(wakes(local).map(w => w.names), [['seen']]);
});

// ---------------------------------------------------------------- loops without time passing end at the step limit

test('a zero-time loop ends at the step limit, whose report names the instant and the activations that ran; bounded drains pass', async () => {
    const r = await fixture('p4-stateloop.swaml');
    // The prototype's StateLoop cases (states-p7 p4-stateloop.txt): StateLoop is cut, so every endless one ends at the limit.
    const expected: Record<string, [string, string | undefined, number]> = {
        'Drain by re-arrival': ['pass', undefined, 300],
        'Drain by a staying statement': ['pass', undefined, 164],
        'Wake ping-pong': ['inconclusive', 'limit', 200001],
        'Growing ping-pong': ['inconclusive', 'limit', 200001],
        'Four-step handshake': ['pass', undefined, 165],
        'Arrival ping-pong': ['inconclusive', 'limit', 200001],
        'Arrival ping-pong with a request': ['inconclusive', 'limit', 200001],
    };
    for (const [name, [result, reason, steps]] of Object.entries(expected)) {
        assert.equal(r.get(name)?.result, result, name);
        assert.equal(r.get(name)?.reason, reason, name);
        assert.equal(r.get(name)?.run?.steps, steps, `${name} steps`);
    }
    const violation = trace(r.get('Arrival ping-pong')).find(e => e.kind === 'violation')!;
    assert.equal(violation.code, 'StepLimit');
    assert.match(String(violation.message), /^StepLimit: the run reached maxSteps = 200000 at \d+ns; activations that ran at this instant: .*arrival\.run \(state \w+\)/);
});

test('a zero-time loop through while (true) ends at the step limit; the same loop bounded with 3 times goes on', async () => {
    const r = await one(`run() {
      state z { on receive in.k() { ready = true; exit; } }
      while (true) {
        state a { if (ready) exit; }
      }
    }`, 'publish bench.out.k(); wait 1ms;', 'n = 1;');
    assert.deepEqual([r.result, r.reason], ['inconclusive', 'limit']);
    assert.equal(trace(r).find(e => e.kind === 'violation')!.message, 'StepLimit: the run reached maxSteps = 200000 at 0ns; activations that ran at this instant: m.run (state a), Unit::T.');
    const bounded = await one(`run() {
      state z { on receive in.k() { ready = true; exit; } }
      while (true, 3 times) {
        state a { if (ready) exit; }
      }
      y = 1;
    }`, 'publish bench.out.k(); wait 1ms; assert m.y == 1;', 'n = 1;');
    pass(bounded, 'bounded loop');
});

test('a cycle of states that leave each other is not an error: a state in while (true) whose on entry waits runs every 10 ms (review 3 F4)', async () => {
    const r = await one(`run() {
      state idle { on receive in.k() exit; }
      while (true) {
        state blink {
          on entry { n = n + 1; wait 10ms; }
          exit;
        }
      }
    }`, 'publish bench.out.k(); wait 95ms; assert m.n == 10;');
    pass(r, 'blink');
});

// ---------------------------------------------------------------- reading sample 8 (SIF-R04, SIF-R07; gate E)

test('reading sample 8: a look reads the values when it runs; Q2 reverses; the flip sees 3000; Q5 goes to idle (sampled and filtered)', async () => {
    const r = await fixture('p4-antipinch-sampled.swaml');
    const steps: Record<string, number> = { 'Q1 5000 at 100 ms': 136, 'Q2 halt then 5000 at one instant': 125, 'Q3 already 5000 on arrival': 114, 'Q5 5000 exactly at 8 s': 96, 'Flip 5000 then 3000 at one instant': 84, 'Flip 5000 then 3000 one ns apart': 131 };
    for (const [name, n] of Object.entries(steps)) {
        pass(r.get(name), name);
        assert.equal(r.get(name)?.run?.steps, n, `${name} steps`);
    }
    const lifter = (name: string) => stateLines(r.get(name), 'lifter.control');
    // Q1: the delivery updates the cell and wakes closing, which reverses at 100 ms.
    assert.deepEqual(wakes(r.get('Q1 5000 at 100 ms')).map(w => [w.ms, w.cause, w.cell]), [[100, 'sample', 'lifter.sense.current']]);
    assert.deepEqual(lifter('Q1 5000 at 100 ms'), ['0ms state idle', '0ms state closing', '100ms state reversing', '500ms state idle']);
    // Q2 (corrected in revision 5): the request's look runs after the second delivery and reverses before the request's
    // line; the request stays queued (revision 6) and reversing, which does not name it, drops it when it begins to wait.
    assert.deepEqual(lifter('Q2 halt then 5000 at one instant'), ['0ms state idle', '0ms state closing', '100ms state reversing', '500ms state idle']);
    assert.deepEqual(trace(r.get('Q2 halt then 5000 at one instant')).filter(e => e.kind === 'discardInput').map(e => e.reason), ['inactiveOwner']);
    // Q3: the arrival look checks the condition.
    assert.deepEqual(lifter('Q3 already 5000 on arrival'), ['0ms state idle', '10ms state closing', '10ms state reversing', '410ms state idle']);
    // Q5: the timer is looked at before the delivery of the same instant.
    assert.deepEqual(lifter('Q5 5000 exactly at 8 s'), ['0ms state idle', '0ms state closing', '8000ms state idle']);
    // The flip: one look, after both updates, sees 3000; one nanosecond apart, the first update reverses.
    assert.deepEqual(lifter('Flip 5000 then 3000 at one instant'), ['0ms state idle', '0ms state closing']);
    assert.equal(wakes(r.get('Flip 5000 then 3000 at one instant')).length, 1);
    assert.deepEqual(lifter('Flip 5000 then 3000 one ns apart').slice(2, 3), ['100ms state reversing']);
    // Q4 (filtered): closing looks at every write of motorCurrent and never sees the raw 9000.
    const filtered = await fixture('p4-antipinch-filtered.swaml');
    const filteredSteps: Record<string, number> = { 'Q4 9000 for one millisecond': 3111, 'Spike of three milliseconds': 2867, 'Closing for one second': 20073 };
    for (const [name, n] of Object.entries(filteredSteps)) {
        pass(filtered.get(name), name);
        assert.equal(filtered.get(name)?.run?.steps, n, `${name} steps`);
    }
});

// ---------------------------------------------------------------- SIF-D04

const machine = (control: string, entry = 'run'): Sample => ({
    pkg: 'Values', entry, control, types: 'import Swaml::Time;',
    ports: { p: [['n', 'requires event n()'], ['k', 'requires event k()']].filter(([m]) => control.includes(`p.${m}(`)).map(([, d]) => d) },
    attributes: 'attribute x: uint = 0; attribute t0: uint = 0;',
    ops: 'operation late() returns bool { return now() > t0 + 5000000; } operation later() returns bool { return late(); }',
});
const errorsOf = async (control: string) => (await parseSample(sampleModel(machine(control), ''))).errors.map(e => `${String(e.code)} ${e.message}`);

test('SIF-D04 an if standing in a state of a waiting machine whose condition reads now(), directly or through a called operation, is an error', async () => {
    assert.deepEqual(await errorsOf(`run() {
      state s {
        if (now() > t0) exit;
        on receive p.n() exit;
      }
    }`), ['SW2006 if (now() > t0) in s reads now(); a waiting state tests it only when something wakes it and time passing wakes nothing, so write after D instead (SIF-D04).']);
    assert.deepEqual(await errorsOf(`run() {
      state s {
        x = x + 1;
        if (x > 3) exit; else if (later()) exit;
        on receive p.n() exit;
      }
    }`), ['SW2006 if (later()) in s reads now(); a waiting state tests it only when something wakes it and time passing wakes nothing, so write after D instead (SIF-D04).']);
    // Plain statements, an event line's block, on entry and on exit read it when they run: no error (review 3 F5).
    assert.deepEqual(await errorsOf(`run() {
      state s {
        t0 = now();
        on entry { t0 = now(); }
        on exit { t0 = now(); }
        on receive p.n() { if (late()) exit; }
      }
    }`), []);
    // A periodic machine looks at every release, so its conditions may read the clock.
    const periodic = sampleModel(machine(`run() {
      state s { if (now() > t0 + 5000000000) exit; }
    }`), '').replace('on start run();', 'on every 10ms run();');
    assert.deepEqual((await parseSample(periodic)).errors.map(e => e.message), []);
});
