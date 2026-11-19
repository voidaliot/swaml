// States in the flow, package 5 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 3.14 to 3.16, 4.4 to 4.6, 7.4 gate F, 9):
// periodic machines. SIF-R14 (one persistent activation; the current state stays entered; one look per release; leaving
// continues in the release), SIF-R15 (timers across releases and skipped releases, one message per release in delivery
// order, input of members the state does not name dropped at the release, deadline per release from the release, release
// guards with skip carrying the machine's activation), SIF-R16 (held arrivals), SIF-R17 (periodic end and restart),
// SIF-S01 for on every, T4 per section 9, the periodic Timing projection, reading samples 9 and 10 and gate F (the
// door showcase with MirrorHeater.tick and SupplyMonitor.classify written as periodic machines). The fixture models are the
// interpreter prototype's (states-p7: p6-periodic, p6-window-10ms, p6-traffic-connection, p6-heater-supply, p7-own-writes);
// results and step counts are those of its recorded evidence unless a comment says otherwise. Each runtime case names the
// mutation of the plan's package 5 it kills (scripts/mutations-sif2.mjs, E1 to E9, D7).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { eachTest, type CaseResult, type SimulationOptions } from '../../src/simulation/simulator.js';
import { projectOperationTiming } from '../../src/simulation/timing.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const root = new URL('../../../', import.meta.url), fixtures = new URL('test/fixtures/states-in-flow/', root);

async function load(text: string, uri: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(text, { documentUri: uri, validation: true });
    return { model: document.parseResult.value, diagnostics: (document.diagnostics ?? []).map(d => ({ severity: d.severity, code: String(d.code), message: d.message, line: d.range.start.line + 1 })) };
}
/** Every case of a model text (or only the case named), by case name; the model must have no error. */
async function cases(text: string, uri = 'file:///periodic.swaml', options: Partial<SimulationOptions> = {}, only?: string): Promise<Map<string, CaseResult>> {
    const { model, diagnostics } = await load(text, uri);
    assert.deepEqual(diagnostics.filter(d => d.severity === 1), [], 'model is valid');
    return new Map([...eachTest([model], { untilNs: 100_000_000_000, maxSteps: 200000, ...options }, only ? { case: only } : {})].map(r => [r.case.slice(r.case.indexOf('::') + 2), r]));
}
const fixture = (file: string, only?: string) => cases(readFileSync(new URL(file, fixtures), 'utf8'), `file:///${file}`, {}, only);
const trace = (r: CaseResult | undefined): Observation[] => (r?.run?.trace ?? []) as Observation[];
const pass = (r: CaseResult | undefined, what: string) => assert.equal(r?.result, 'pass', `${what}: ${r?.reason ?? ''} ${r?.message ?? ''}`);
const ms = (e: Observation) => e.timeNs / 1e6;
const states = (r: CaseResult | undefined, subject: string) => trace(r).filter(e => e.kind === 'state' && e.subject === subject).map(e => `${ms(e)}ms ${e.stay ? 'stay' : 'state'} ${e.state}${e.held ? ' held' : ''}`);
const writes = (r: CaseResult | undefined, subject: string) => trace(r).filter(e => e.kind === 'write' && e.subject === subject).map(e => `${ms(e)}ms ${JSON.stringify(e.value)}`);

/**
 * A component def M with an input port in (events m(v: uint), n(), done()), attributes x, y (uint) and go (bool), the operation
 * step() given, released on every 10 ms with the entry tail given (a guard, a deadline), and a test 'T' of m with script.
 */
const unit = (step: string, script: string, entry = '', extra = '') => `package Unit {
  port def In { provides event m(v: uint); provides event n(); provides event done();${entry.includes('in.flag') ? ' provides attribute flag: bool = false;' : ''} }
  component def M {
    reversed port in: In;
    attribute x: uint = 0;
    attribute y: uint = 0;
    attribute go: bool = false;
    operation sink(v: uint) { y = y + v; }
    operation idle() { }
    operation ${step}
    ${extra}
    schedule { on every 10ms step()${entry}; ${['m', 'n', 'done'].filter(x => !step.includes(`in.${x}(`)).map(x => `on receive in.${x}(${x === 'm' ? 'v' : ''}) ${x === 'm' ? 'sink(v)' : 'idle()'};`).join(' ')} }
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
const one = async (step: string, script: string, entry?: string, extra?: string) => (await cases(unit(step, script, entry, extra))).get('T')!;

// ---------------------------------------------------------------- SIF-R14 to SIF-R17: the prototype's periodic cases

test('SIF-R14 to SIF-R17 the prototype periodic cases: parent line per release, entered and left in one release, release bound, end and restart, deadline, messages', async () => {
    const r = await fixture('p6-periodic.swaml');
    // Results and step counts of the recorded evidence (states-p7 p6-periodic-cases.txt, p7-release-bound.txt).
    const expected: Record<string, [string, number]> = {
        'B2 a query at every release while closing and at the pinch': ['pass', 1302], 'Entered and left in one release': ['pass', 296],
        'Zero-time cycle in one release': ['pass', 125], 'Zero-time cycle that grows': ['pass', 160], 'End and restart': ['pass', 467],
        'Deadline miss by a long look': ['fail', 168], 'Messages between releases': ['pass', 523],
    };
    for (const [name, [result, steps]] of Object.entries(expected)) {
        assert.equal(r.get(name)?.result, result, `${name}: ${r.get(name)?.message ?? ''}`);
        assert.equal(r.get(name)?.run?.steps, steps, `${name} steps`);
    }
    // SIF-R16 (kills E5, the bound counting the first arrival): a, b, c and d are passed in the release in which go holds;
    // the zero-time cycle a, b, a ends its release at the held arrival of a, never at the step limit.
    assert.deepEqual(states(r.get('Entered and left in one release'), 'chain.step').slice(0, 5), ['10ms state a', '20ms state b', '20ms state c', '20ms state d', '30ms state a']);
    const spin = states(r.get('Zero-time cycle in one release'), 'spin.step');
    assert.deepEqual(spin, ['10ms state a', '10ms state b', '10ms state a held']);
    assert.ok(!trace(r.get('Zero-time cycle in one release')).some(e => e.kind === 'violation'));
    // SIF-R17 (kills E6, the end treated as an error or a completion): three looks, the end, no state, a restart at the next
    // release with the local declared again; the activation never completes.
    const restart = trace(r.get('End and restart')).filter(e => e.subject === 'restart.step');
    assert.deepEqual(restart.filter(e => e.kind === 'periodicEnd').map(e => [ms(e), e.release]), [[30, 3], [60, 6]]);
    assert.equal(new Set(restart.filter(e => e.activation).map(e => e.activation)).size, 1, 'one activation for the life of the occurrence');
    assert.ok(!restart.some(e => e.kind === 'complete' || e.kind === 'failure'));
    assert.equal(r.get('End and restart')?.run?.machines['restart.step']?.state, 'counting');
    // SIF-R15 (kills E9, the deadline measured from the dispatch): the look at 20 ms suspends 3 ms; the deadline of 2 ms
    // from that release is missed at 22 ms.
    const deadline = trace(r.get('Deadline miss by a long look')).find(e => e.kind === 'violation')!;
    assert.deepEqual([ms(deadline), deadline.code], [22, 'Deadline']);
    // SIF-R15 (kills E3, two messages taken in one release): one message per release in delivery order; n, not named by a,
    // is dropped at the release (both n were queued at a's first release look); after done, b takes m(4).
    assert.deepEqual(writes(r.get('Messages between releases'), 'messages.got'), ['20ms 1', '30ms 12', '40ms 123', '60ms 1234']);
    assert.deepEqual(writes(r.get('Messages between releases'), 'messages.ns'), []);
    assert.equal(trace(r.get('Messages between releases')).filter(e => e.kind === 'discardInput' && e.reason === 'inactiveOwner').length, 2);
});

test('reading sample 9: the periodic window controller (Q1 to Q5) and the traffic light and connection manager every 100 ms', async () => {
    const r = await fixture('p6-window-10ms.swaml');
    // Q5 takes 844 steps here, 822 in the prototype: the release guard of a periodic machine is evaluated by the machine's
    // activation under the lock (WP7-R01), one resumption per skipped release, not at the release event.
    const expected: Record<string, number> = { 'Q1 to Q3 switch up at 25 ms, neutral at 95 ms': 290, 'Q4 pinch and neutral at one release': 226, 'Q5 guard false while reversing': 844 };
    for (const [name, steps] of Object.entries(expected)) {
        pass(r.get(name), name);
        assert.equal(r.get(name)?.run?.steps, steps, `${name} steps`);
    }
    // Q1 to Q3 (kills E4, the arrival look skipped): closing is reached at 30 ms and travel counts in that release.
    const q1 = r.get('Q1 to Q3 switch up at 25 ms, neutral at 95 ms');
    assert.deepEqual(states(q1, 'controller.step'), ['10ms state idle', '30ms state closing', '100ms state idle']);
    assert.deepEqual(writes(q1, 'controller.travel')[0], '30ms 1');
    // Kills E1 (on entry rerun at each release): the motor is driven once per arrival.
    assert.deepEqual(trace(q1).filter(e => e.kind === 'send' && e.subject === 'controller.motor.drive').map(e => `${ms(e)}ms ${e.args[0]}`), ['10ms stop', '30ms up', '100ms stop']);
    // Q4: the pinch condition is written first; the look stops at the first leave.
    assert.deepEqual(states(r.get('Q4 pinch and neutral at one release'), 'controller.step').slice(2), ['80ms state reversing']);
    // Q5 (kills E2, a timer reset or paused by skipped releases; E8, a skip without activation): the 400 ms timer is due at
    // 550 ms, the releases from 500 ms to 600 ms are skipped, and the first release that runs, at 610 ms, takes it.
    const q5 = r.get('Q5 guard false while reversing'), skips = trace(q5).filter(e => e.kind === 'skip');
    assert.deepEqual(skips.map(e => ms(e)), [500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600]);
    const activation = trace(q5).find(e => e.kind === 'release' && e.subject === 'controller.step')!.activation;
    assert.ok(skips.every(e => e.activation === activation && typeof e.release === 'number'));
    assert.deepEqual(states(q5, 'controller.step').filter(l => /reversing|idle/.test(l)).slice(-2), ['150ms state reversing', '610ms state idle']);
    // The traffic light and the connection manager released every 100 ms (1.10, 1.11; states-p7 p6-traffic-connection).
    const t = await fixture('p6-traffic-connection.swaml');
    const traffic: Record<string, number> = { 'Light, press at 5 s and in yellow': 2636, 'Light, no press': 5827, 'Connection, no ack': 2608, 'Connection, ack and ran-out timer at one release': 115, 'Connection, ack then down': 260 };
    for (const [name, steps] of Object.entries(traffic)) {
        pass(t.get(name), name);
        assert.equal(t.get(name)?.run?.steps, steps, `${name} steps`);
    }
});

test('reading sample 10: the supply monitor every 50 ms; the arrival look counts (the trap and the counted text) and the heater as a periodic machine', async () => {
    const r = await fixture('p6-heater-supply.swaml', 'HeaterSupply::Supply dips');
    const dips = r.get('Supply dips');
    pass(dips, 'Supply dips');
    assert.equal(dips?.run?.steps, 1291);
    const changes = (subject: string) => { let last: unknown; return trace(dips).filter(e => e.kind === 'write' && e.subject === subject && (e.value !== last ? (last = e.value, true) : false)).map(e => `${ms(e)}ms ${e.value}`); };
    // Q1 and Q4: the three-state text qualifies one low release (100 ms) and the single low release at 400 ms.
    assert.deepEqual(changes('supplyTrap.undervoltage'), ['100ms true', '300ms false', '400ms true', '450ms false']);
    // Q2, Q3, Q5: the counted text reports at the second low release (200 ms) and clears at 300 ms, like the flag code.
    assert.deepEqual(changes('supplyCounted.undervoltage'), ['200ms true', '300ms false']);
    assert.deepEqual(changes('supply.undervoltage').filter(l => l !== '50ms false'), ['200ms true', '300ms false']);
    assert.deepEqual(changes('supplyStates.undervoltage'), ['200ms true', '300ms false']);
});

test('SIF-R08 a periodic machine sees its own line\'s write at the next release, never in a second look of the same release (kills D7)', async () => {
    const r = await fixture('p7-own-writes.swaml', 'OwnWrites::Periodic sees its write at the next release');
    const c = r.get('Periodic sees its write at the next release');
    pass(c, 'periodic own write');
    assert.equal(c?.run?.steps, 168);
    assert.deepEqual(trace(c).filter(e => e.kind === 'wake' && e.subject === 'periodicCounter.step'), []);
    // travel counts releases: one per release up to the release after the message, none twice.
    const travel = writes(c, 'periodicCounter.travel');
    assert.equal(new Set(travel.map(l => l.split(' ')[0])).size, travel.length, 'one write per release');
});

// ---------------------------------------------------------------- unit cases

test('SIF-R14 the current state stays entered across releases: on entry once, a statement per release, timers present once (kills E1, E2)', async () => {
    const r = await one(`step() {
      state s {
        on entry { x = x + 1; }
        y = y + 1;
        after 25ms { x = x + 10; }
        if (go) exit;
      }
      state t { on receive in.done() exit; }
    }`, 'wait 55ms; assert m.x == 11 and m.y == 5;');
    pass(r, 'stays entered');
    // Releases at 10 to 50 ms: one look each; the timer, due at 35 ms, is present at the release at 40 ms only.
    assert.deepEqual(writes(r, 'm.x'), ['10ms 1', '40ms 11']);
});

test('SIF-R15 input between releases stays queued, also before the first release; one message per release in delivery order (kills E3)', async () => {
    const r = await one(`step() {
      state s {
        on receive in.m(v) { x = x * 10 + v; }
        on receive in.n() { y = y + 1; }
      }
    }`, 'publish bench.out.m(1); publish bench.out.n(); publish bench.out.m(2); wait 45ms; assert m.x == 12 and m.y == 1;');
    pass(r, 'one per release');
    // The arrival look at 10 ms has no message; the releases at 20, 30 and 40 ms take m(1), n() and m(2).
    assert.deepEqual(writes(r, 'm.x'), ['20ms 1', '40ms 12']);
    assert.deepEqual(writes(r, 'm.y'), ['30ms 1']);
});

test('SIF-R15 a release guard false at the first release skips it with the machine\'s activation; the flow starts at the first release whose guard holds (kills E8)', async () => {
    const r = await one(`step() {
      state s {
        on entry { x = x + 1; }
        y = y + 1;
      }
    }`, 'wait 25ms; send bench.out.flag(true); wait 20ms; assert m.x == 1 and m.y == 2;', ' if (in.flag)', '');
    pass(r, 'first release skipped');
    const skips = trace(r).filter(e => e.kind === 'skip');
    assert.deepEqual(skips.map(e => [ms(e), e.release]), [[10, 1], [20, 2]]);
    const activation = trace(r).find(e => e.kind === 'release' && e.subject === 'm.step')!.activation;
    assert.ok(skips.every(e => e.activation === activation));
    assert.deepEqual(states(r, 'm.step'), ['30ms state s']);
});

test('SIF-R16 a state reached a second time in one release is held: entered, no arrival look, the release ends there (kills E4, E5)', async () => {
    const r = await one(`step() {
      while (true) {
        state a {
          on entry { x = x + 1; }
          y = y + 1;
          if (go) exit;
        }
        state b { if (go) exit; }
      }
    }`, 'wait 15ms; m.begin(); wait 20ms; assert m.x == 3 and m.y == 3;', '', 'operation begin() { go = true; }');
    pass(r, 'held arrival');
    // 10 ms: a (y 1). 20 ms: a's release look (y 2) leaves, b leaves, a again: held, no arrival look. 30 ms: a's release look
    // (y 3) leaves, b, a held.
    assert.deepEqual(states(r, 'm.step'), ['10ms state a', '20ms state b', '20ms state a held', '30ms state b', '30ms state a held']);
});

test('SIF-R17 a periodic machine that reaches its end or return has no state; the next release starts the flow from the top with its locals declared again (kills E6)', async () => {
    const r = await one(`step() {
      var n: uint = 0;
      state s {
        n = n + 1;
        if (n >= 2) exit;
      }
      if (x >= 1) { return; }
      x = x + 1;
      state t { if (true) exit; }
    }`, 'wait 55ms; assert m.x == 1;');
    pass(r, 'end and return');
    assert.deepEqual(trace(r).filter(e => e.kind === 'periodicEnd').map(e => [ms(e), e.release]), [[20, 2], [40, 4]]);
    assert.deepEqual(states(r, 'm.step'), ['10ms state s', '20ms state t', '30ms state s', '50ms state s']);
    assert.equal(r.run?.machines['m.step']?.state, 's');
});

test('SIF-R15 the deadline is per release, from the release; a release whose look suspends past it violates Deadline (kills E9)', async () => {
    const r = await one(`step() {
      state s {
        if (go) { wait 3ms; }
      }
    }`, 'wait 15ms; m.begin(); wait 20ms;', ' deadline 2ms', 'operation begin() { go = true; }');
    assert.equal(r.result, 'fail');
    const v = trace(r).find(e => e.kind === 'violation')!;
    assert.deepEqual([ms(v), v.code], [22, 'Deadline']);
});

test('SIF-R15 after successors are released after the work of each release of a periodic machine, a skipped release included', async () => {
    // The entry tail closes the every entry and adds the after entry: on every 10ms step() if (in.flag); after step count();
    const r = await one(`step() {
      state s { x = x + 1; }
    }`, 'wait 15ms; send bench.out.flag(true); wait 20ms; assert m.x == 2 and m.y == 3;', ' if (in.flag); after step count()', 'operation count() { y = y + 1; }');
    pass(r, 'successors per release');
    // 10 ms: skipped (count 1); 20 ms and 30 ms: one look each (count 2 and 3); the machine never completes.
    assert.deepEqual(writes(r, 'm.y'), ['10ms 1', '20ms 2', '30ms 3']);
    assert.ok(!trace(r).some(e => e.kind === 'complete' && e.subject === 'm.step'));
});

// ---------------------------------------------------------------- static rules: SIF-S01 on every, T4

test('SIF-S01 an operation with states may be released on every; an event line on a rejecting route gets no warning (SIF-D06 is cut)', async () => {
    const { diagnostics } = await load(unit(`step() {
      state a { to b; }
      state b { to a; }
      state c { on receive in.m(v) { x = v; } }
    }`, ''), 'file:///d06.swaml');
    assert.deepEqual(diagnostics.filter(d => d.severity === 1), [], 'no error: on every is accepted and the zero-time cycle is bounded per release');
    // The default connection policy rejects on overflow: the run reports a sender that overflows; the text gets no warning.
    assert.deepEqual(diagnostics.filter(d => d.code === 'SW2018'), []);
    // A dropping member policy: no warning either.
    const dropping = unit('step() { state c { on receive in.m(v) { x = v; } } }', '').replace('package Unit {', 'package Unit {\n  import Swaml::Qos;').replace('  component def Bench', '  qos def Drop: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 8; overflow = Overflow.dropOldest; requestTimeout = 1s; }\n  component def Bench').replace('connect (bench.out, m.in);', 'connect (bench.out, m.in) { m: Drop; }');
    const d2 = await load(dropping, 'file:///d06b.swaml');
    assert.deepEqual(d2.diagnostics.filter(d => d.severity === 1 || d.code === 'SW2018'), []);
    // concurrent stays rejected.
    const concurrent = await load(unit('step() { state c { y = y + 1; } }', '', ' concurrent'), 'file:///c.swaml');
    assert.ok(concurrent.diagnostics.some(d => d.severity === 1 && String(d.message).includes('not concurrent (SIF-S01)')));
});

test('T4 (section 9): a waiting machine needs an extended Task; a periodic machine may use a basic Task unless something it runs can suspend', async () => {
    const platform = (op: string, entry: string, task: string) => `package T4 {
  import Swaml::Platform;
  import Swaml::Os;
  component def M {
    attribute x: uint = 0;
    operation step() { ${op} }
    schedule { ${entry} }
  }
  component m: M;
  component def Ecu specializes Node {
    component t: Task {
      redefines const attribute kind: TaskKind = TaskKind.${task};
      redefines const attribute priority: uint = 20;${entry.includes('every') ? '\n      redefines const attribute periodNs: uint = 10ms;' : ''}
    }
  }
  component ecu: Ecu;
  deployment D of m on ecu {
    deploy step on t;
  }
}`;
    const errors = async (op: string, entry: string, task: string) => (await load(platform(op, entry, task), 'file:///t4.swaml')).diagnostics.filter(d => d.severity === 1).map(d => `${d.code} ${d.message}`);
    assert.deepEqual(await errors('state s { x = x + 1; }', 'on every 10ms step();', 'basic'), []);
    assert.ok((await errors('state s { x = x + 1; if (x > 3) { wait 1ms; } }', 'on every 10ms step();', 'basic')).some(m => m.startsWith('SW2009')), 'a periodic machine whose look can wait');
    assert.ok((await errors('state s { x = x + 1; }', 'on start step();', 'basic')).some(m => m.startsWith('SW2009')), 'a waiting machine on a basic Task');
    assert.deepEqual(await errors('state s { x = x + 1; }', 'on start step();', 'extended'), []);
});

// ---------------------------------------------------------------- Timing projection (4.6)

test('4.6 the Timing projection of a periodic machine: one interval per release, idle between releases, a state band per arrival, skips and the end as markers', async () => {
    const r = await one(`step() {
      var n: uint = 0;
      state s {
        n = n + 1;
        if (n >= 2) exit;
      }
      state t { if (true) exit; }
    }`, 'wait 25ms; send bench.out.flag(false); wait 30ms;', ' if (not in.flag or x == 0)');
    const timing = projectOperationTiming(r.run!);
    const machine = timing.intervals.filter(i => i.subject === 'm.step');
    assert.ok(machine.length >= 5);
    assert.ok(machine.every(i => i.phase === 'release' && typeof i.release === 'number' && i.endNs !== undefined && i.endNs <= i.startNs + 1e7), 'one interval per release, closed before the next');
    assert.deepEqual(machine.map(i => i.release), machine.map((_, i) => i + 1));
    const bands = (timing.states ?? []).filter(b => b.subject === 'm.step').map(b => `${b.state} ${b.startNs / 1e6}-${(b.endNs ?? NaN) / 1e6}`);
    // s from 10 ms; at 20 ms s leaves for t, which leaves too: the end closes the band; 30 ms starts again.
    assert.deepEqual(bands.slice(0, 3), ['s 10-20', 't 20-20', 's 30-40']);
    assert.ok(timing.markers.some(e => e.kind === 'periodicEnd'));
});

// ---------------------------------------------------------------- gate F

const HEATER = readFileSync(new URL('mirror-heater-periodic.swaml-fragment', fixtures), 'utf8'), SUPPLY = readFileSync(new URL('supply-monitor-periodic.swaml-fragment', fixtures), 'utf8');
function replaceOperation(text: string, component: string, operation: string, replacement: string): string {
    const at = text.indexOf(`  component def ${component} {`), start = text.indexOf(`    operation ${operation}() {`, at);
    let depth = 0, end = start;
    for (; end < text.length; end++) {
        if (text[end] === '{')
            depth++;
        else if (text[end] === '}' && --depth === 0)
            break;
    }
    return text.slice(0, start) + replacement.trimEnd() + text.slice(end + 1);
}
const REWRITTEN = ['heater', 'supply'];
/**
 * The heater's tick counter, which the periodic machine replaces by its 600 s timer (1.12: "the counter is gone"); it stays
 * declared and is never written by the rewrite, so it is not compared.
 */
const REPLACED = 'heaterTicks';
/**
 * What gate F compares of one case: the verdict, every final store (but the replaced counter), and the sends and the value
 * changes of the attributes of the rewritten components, in order.
 */
function compared(result: CaseResult, initial: ReadonlyMap<string, unknown>) {
    const { run, ...verdict } = result;
    const rewritten = (s: string) => REWRITTEN.some(c => s === c || s.startsWith(`${c}.`) || s.includes(`.${c}.`));
    // The value each attribute had last: its initial value until it is written, so that a write of an unchanged value is no change.
    const last = new Map<string, unknown>(), seen = new Set<string>();
    for (const e of (run?.trace ?? []) as Observation[])
        if (e.kind === 'write' && !seen.has(e.subject)) {
            seen.add(e.subject);
            last.set(e.subject, initial.get(String(e.subject).split('.').at(-1)!));
        }
    const stores = Object.fromEntries(Object.entries(run?.stores ?? {}).map(([path, store]) => [path, Object.fromEntries(Object.entries(store).filter(([n]) => !(path.endsWith('.heater') && n === REPLACED)))]));
    const observable = ((run?.trace ?? []) as Observation[]).filter(e => rewritten(String(e.subject)) && !String(e.subject).endsWith(`.${REPLACED}`) && (e.kind === 'send' || e.kind === 'write' && e.scope === 'attribute' && JSON.stringify(last.get(e.subject)) !== JSON.stringify(e.value) && (last.set(e.subject, e.value), true))).map(e => `${e.timeNs} ${e.kind} ${e.subject} ${JSON.stringify(e.value ?? e.args)}`);
    return { verdict: { result: verdict.result, reason: verdict.reason, message: verdict.message }, stores, observable };
}

test('gate F: the door showcase with MirrorHeater.tick and SupplyMonitor.classify as periodic machines gives the same verdicts, stores, sends and writes in all cases', async () => {
    const original = readFileSync(new URL('examples/showcase/autosar-classic-door-controller.swaml', root), 'utf8').replaceAll('\r\n', '\n');
    const rewritten = replaceOperation(replaceOperation(original, 'MirrorHeater', 'tick', HEATER), 'SupplyMonitor', 'classify', SUPPLY);
    assert.notEqual(rewritten, original);
    const uri = 'file:///examples/showcase/autosar-classic-door-controller.swaml', options = { untilNs: 10_000_000_000, maxSteps: 200000 };
    const before = await load(original, uri), after = await load(rewritten, uri);
    assert.deepEqual(after.diagnostics.filter(d => d.severity === 1), []);
    const x = [...eachTest([before.model], options)], y = [...eachTest([after.model], options)];
    assert.equal(x.length, 36, 'the door showcase has 36 cases');
    assert.equal(y.length, x.length);
    // The initial values of the two components' attributes (all literals).
    const initial = new Map<string, unknown>();
    for (const def of before.model.packages.flatMap(p => p.elements).filter(a.isComponentDef).filter(d => d.name === 'MirrorHeater' || d.name === 'SupplyMonitor'))
        for (const attribute of def.members.filter(a.isAttribute))
            initial.set(attribute.name, JSON.parse(attribute.value!.$cstNode!.text.replace(/\s*\/\*\*.*\*\//su, '')));
    assert.equal(initial.get('undervoltage'), false);
    let identical = 0;
    for (const [i, b] of x.entries()) {
        const p = compared(b, initial), q = compared(y[i], initial);
        assert.deepEqual(q.verdict, p.verdict, `verdict of ${b.case}`);
        assert.deepEqual(q.stores, p.stores, `stores of ${b.case}`);
        assert.deepEqual(q.observable, p.observable, `sends and writes of heater and supply in ${b.case}`);
        identical++;
    }
    assert.equal(identical, 36);
});
