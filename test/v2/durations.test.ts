// WP4 of swa.ml 2.3: durations as values (WP4-G01..G04, WP4-S01..S08, WP4-R01, WP4-R02, WP4-D01..D07, WP4-T01,
// WP4-M01..M04, WP4-M08). A duration literal is a uint value in nanoseconds; wait (e), or after (e), state
// timers after (e), on every (e) and deadline (e) take computed durations; periods and deadlines use the constant
// sublanguage, evaluated per expanded occurrence by constantValue; PolicySetting has one form.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { AstUtils, EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { constantValue, displayText, effectiveQos, entryDeadline, entryKey, entryPeriod, expressionText, expressionTypes, occurrences, schedule, settingDuration, triggerIdentity } from '../../src/language/semantic.js';
import { runCase, simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { invalid, parse, valid } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const root = new URL('../../../', import.meta.url);
const wrap = (body: string, extra = '') => `package Test {
  import Swaml::Numeric;
  import Swaml::Time;
  ${extra}
  component def D {
    ${body}
  }
  component Demo: D;
}`;
const diagnostics = async (source: string) => (await parse(source)).doc.diagnostics?.map(d => [d.code, d.message]) ?? [];
const errors = async (source: string) => (await parse(source)).errors.map(e => [String(e.code), e.message]);
const warnings = async (source: string) => (await parse(source)).warnings.map(e => [e.code, e.message]);
const nodesOf = <T extends a.Expression | a.ScheduleEntry | a.EventLine | a.Wait | a.Receive | a.PolicySetting>(m: Model, is: (n: unknown) => n is T) => AstUtils.streamAllContents(m).filter(is).toArray();
const run = async (source: string, untilNs = 1000000000, target = 'Test::Demo') => { const r = await valid(source); return simulate([r.model], target, { untilNs }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const kinds = (trace: readonly Observation[], ...k: string[]) => trace.filter(t => k.includes(t.kind));
/** The kept 2.2 grammar (the 3.1.0 parser), for recovery comparisons. */
const kept22 = async () => {
    const { parsers } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as { parsers(): Promise<{ kept: { parser: { LangiumParser: { parse(text: string): { value: unknown; parserErrors: unknown[]; lexerErrors: unknown[] } } } } }> };
    return (await parsers()).kept.parser.LangiumParser;
};

// ---------------------------------------------------------------- grammar

test('WP4-G01 WP4-M01 a policy setting is name = Expression; a 2.2 duration setting is Literal{duration} and keeps its nanoseconds', async () => {
    const r = await valid(`package Test {
  import Swaml::Qos;
  qos def P: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 4; overflow = Overflow.reject; requestTimeout = 2 s; maxLatency = 5ms; maxAge = (300us); }
}`);
    const settings = nodesOf(r.model, a.isPolicySetting);
    const timeout = settings.find(s => s.name === 'requestTimeout')!;
    assert.ok(a.isLiteral(timeout.value) && timeout.value.duration && timeout.value.duration.value === 2 && timeout.value.duration.unit === 's');
    assert.equal(settingDuration(timeout)?.unit, 's');
    assert.equal(settingDuration(settings.find(s => s.name === 'capacity')!), undefined);
    const policy = effectiveQos(r.model.packages[0].elements.find(a.isQosPolicy));
    assert.deepEqual([policy.requestTimeout, policy.maxLatency, policy.maxAge, policy.capacity, policy.delivery], [2000000000, 5000000, 300000, 4, 'atMostOnce']);
    // The library policies are 2.2 settings too.
    const library = r.doc.parseResult.value && AstUtils.streamAllContents(createSwamlServices(EmptyFileSystem).shared.workspace.LangiumDocuments.all.find(d => d.uri.toString().includes('swaml-2.0'))!.parseResult.value).filter(a.isPolicySetting).filter(s => s.name === 'requestTimeout').toArray();
    assert.ok(library.length > 0 && library.every(s => a.isLiteral(s.value) && !!s.value.duration));
});

test('WP4-G02 WP4-S01 a duration literal is a uint expression value in nanoseconds, spaced units included', async () => {
    const r = await valid(wrap(`attribute d: uint = 5ms; attribute e: uint = 0; attribute ms: uint = 2;
      operation f() { var x: uint = 1 us + 2 * 3ms; e = x + ms * 1000 + 1s * 0; }
      schedule { on start f(); }`));
    const literals = nodesOf(r.model, a.isLiteral).filter(l => l.duration);
    assert.deepEqual(literals.map(l => [l.duration!.value, l.duration!.unit, expressionTypes.get(l)]), [[5, 'ms', 'uint'], [1, 'us', 'uint'], [3, 'ms', 'uint'], [1, 's', 'uint']]);
    assert.ok(nodesOf(r.model, a.isReferenceExpression).some(x => x.path === 'ms'), 'ms stays an ordinary name');
    const out = simulate([r.model], 'Test::Demo', { untilNs: 1 });
    assert.deepEqual(out.stores.Demo, { d: 5000000, e: 6001000 + 2000, ms: 2 });
});

test('WP4-G03 WP4-G04 computed waits, timeouts, timers, periods and deadlines are parenthesized; literal forms keep their 2.2 properties', async () => {
    const r = await parse(wrap(`const attribute periodMs: uint = 10; attribute n: uint = 1;
      port p { requires event m(); requires event k(); }
      operation f() { wait 1ms; wait (n * 1ms); on receive p.m() { } or after (n * 2ms) { } on receive p.k() { } or after 3ms { } }
      operation g() { state A { after (n * 1ms) to B; } state B { after 1ms to A; } }
      operation h() { }
      schedule { on start f(); on start g(); on every (periodMs * 1ms) h() deadline (periodMs * 1ms / 2); on every 20ms h() deadline 5ms; }`));
    assert.deepEqual([...r.doc.parseResult.lexerErrors, ...r.doc.parseResult.parserErrors], []);
    assert.deepEqual(r.errors.map(e => e.code).filter(c => c !== 'SW2004'), []);
    const [literal, computed] = nodesOf(r.model, a.isWait);
    assert.ok(literal.duration && !literal.delay && computed.delay && !computed.duration, 'Wait.duration is optional (WP4-G03)');
    const [timed, fixed] = nodesOf(r.model, a.isReceive);
    assert.ok(timed.timeoutValue && !timed.timeout && fixed.timeout && !fixed.timeoutValue);
    const [t1, t2] = nodesOf(r.model, a.isEventLine);
    assert.ok(t1.delayValue && !t1.delay && t2.delay && !t2.delayValue);
    const entries = nodesOf(r.model, a.isScheduleEntry).filter(e => e.kind === 'every');
    assert.ok(entries[0].periodValue && !entries[0].period && entries[0].deadlineValue && !entries[0].deadline);
    assert.ok(entries[1].period && !entries[1].periodValue && entries[1].deadline && !entries[1].deadlineValue);
});

// ---------------------------------------------------------------- literals and policies

test('WP4-S01 duration literals in expressions must be representable; zero is a value; narrowing follows the literal rules', async () => {
    assert.deepEqual(await errors(wrap('attribute d: uint = 9007199254740992ns;')), [['SW2013', 'Duration must be positive safe integer nanoseconds.']]);
    assert.deepEqual(await errors(wrap('attribute d: uint = 0ms; attribute b: byte = 200ns;')), []);
    assert.deepEqual(await errors(wrap('attribute b: byte = 1us;')), [['SW2002', 'Expected byte, received uint.']]);
    assert.deepEqual(await errors(wrap('attribute r: real = 1ms; attribute i: int = 1ms; attribute s: string = 1ms;')), [['SW2002', 'Expected string, received uint.']]);
    // The 2.2 positions keep the 2.2 rule: positive.
    assert.deepEqual(await errors(wrap('operation f() { wait 0ms; } schedule { on start f(); }')), [['SW2013', 'Duration must be positive safe integer nanoseconds.']]);
});

const policy = (settings: string) => `package Test {
  import Swaml::Qos;
  qos def P: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; overflow = Overflow.reject; ${settings} }
}`;
test('WP4-S02 WP4-D01 a timeout setting is a duration literal and no other setting is a duration; 2.2 forms keep their 2.2 messages', async () => {
    // 2.2 forms (SW2013 with the 2.2 messages, gate 1 and the sixth extended set).
    assert.deepEqual(await errors(policy('capacity = 5ms; requestTimeout = 1s;')), [['SW2013', 'capacity needs a positive integer count, not a duration.']]);
    assert.deepEqual(await errors(policy('capacity = 4; requestTimeout = 5;')), [['SW2013', 'requestTimeout needs a duration.']]);
    // Computed values are new in 2.3 (WP4-D01).
    assert.deepEqual(await errors(policy('capacity = 4; requestTimeout = 2 * 1s; maxAge = 1ms + 1ms;')), [['SW2013', 'A policy needs complete valid delivery, ordering, capacity, overflow and requestTimeout.'], ['SW2013', 'requestTimeout must be a duration literal such as 1s.'], ['SW2013', 'maxAge must be a duration literal such as 1s.']]);
    assert.deepEqual(await errors(policy('capacity = 4ms * 2; requestTimeout = 1s;')), [['SW2013', 'A policy needs complete valid delivery, ordering, capacity, overflow and requestTimeout.'], ['SW2013', 'capacity is not a duration setting.']]);
    // A parenthesized literal is a literal.
    assert.deepEqual(await errors(policy('capacity = 4; requestTimeout = (1s); maxLatency = (2ms);')), []);
});

// ---------------------------------------------------------------- computed waits and timeouts

test('WP4-S03 WP4-D02 a computed wait or timeout is integral and does not suspend', async () => {
    const component = (op: string) => wrap(`attribute n: uint = 2; attribute r: real = 1.0; const attribute ratio: uint = 2;
      port p { requires event m(); }
      operation pause() returns uint { wait 1ms; return 1; }
      operation f() { ${op} }
      schedule { on start f(); }`, 'port def Q { provides event m(); }');
    assert.deepEqual(await errors(component('wait (n * 1ms); wait (-n * 1ms + 5ms); wait (n * 1ms % 3);')).then(e => e.filter(x => x[0] !== 'SW2004' && x[0] !== 'SW2005')), []);
    assert.deepEqual((await errors(component('wait (r * 1ms);'))).filter(x => x[0] === 'SW2002'), [['SW2002', 'A duration must be integral, found real.']]);
    assert.deepEqual((await errors(component('wait (n * 1ms / 2);'))).filter(x => x[0] === 'SW2002'), [['SW2002', 'A duration must be integral, found real.']], 'outside the constant sublanguage / yields real');
    assert.deepEqual((await errors(component('wait (true);'))).filter(x => x[0] === 'SW2002'), [['SW2002', 'A duration must be integral, found bool.']]);
    assert.deepEqual((await errors(component('on receive p.m() { } or after (r * 1ms) { }'))).filter(x => x[0] === 'SW2002'), [['SW2002', 'A duration must be integral, found real.']]);
    assert.ok((await errors(component('wait (pause() * 1ms);'))).some(([c, m]) => c === 'SW2006' && String(m).startsWith('Suspending calls must be standalone')), 'a suspending call (SW2006)');
    assert.ok((await errors(component('on receive p.m() { } or after (pause() * 1ms) { }'))).some(([c, m]) => c === 'SW2006' && String(m).startsWith('Suspending calls must be standalone')));
});

test('WP4-S03 WP4-R02 WP4-T01 a computed wait and timeout are evaluated when the statement starts waiting and record durationNs', async () => {
    const out = await run(wrap(`attribute delayMs: uint = 3; attribute woke: uint = 0; attribute timedOut: uint = 0;
      port p { requires event m(); requires event k(); }
      operation f() {
        wait (delayMs * 1ms);
        woke = now();
        delayMs = 5;
        wait 1ms;
        on receive p.m() { } or after (delayMs * 1ms) { timedOut = now(); }
        on receive p.k() { } or after 2ms { }
      }
      schedule { on start f(); }`, 'port def Q { provides event m(); provides event k(); }').replace('component Demo: D;', `component Demo: D;
  component def S { port q: Q; operation g() { if (false) { publish q.m(); publish q.k(); } } schedule { on start g(); } }
  component s: S;
  connect (s.q, Demo.p);`), 100000000);
    assert.deepEqual(out.stores.Demo, { delayMs: 5, woke: 3000000, timedOut: 9000000 });
    const waits = kinds(out.trace, 'wait', 'receiveWait').filter(t => t.subject === 'Demo.f');
    assert.deepEqual(waits.map(t => [t.kind, t.timeNs, t.durationNs]), [['wait', 0, 3000000], ['wait', 3000000, undefined], ['receiveWait', 4000000, 5000000], ['receiveWait', 9000000, undefined]]);
    assert.ok(!('durationNs' in waits[1]) && !('durationNs' in waits[3]), 'literal waits add no field (WP4-T01)');
});

test('WP4-R01 DurationRange: zero, negative through uint arithmetic and overflow fail before waiting; try catches it; Bounds never', async () => {
    const component = (expression: string) => wrap(`attribute d: uint = 1; attribute ok: bool = true; attribute later: uint = 0;
      operation pause() returns bool { wait (${expression}); return true; }
      operation f() { ok = try(pause(), false); later = now(); }
      schedule { on start f(); }`);
    for (const expression of ['0 * 1ms', '(d - 2) * 1ms', '-d', 'd * 9007199254740991 * 1s', '(d - 1) * 1ms']) {
        const out = await run(component(expression), 100000000);
        assert.deepEqual(out.stores.Demo, { d: 1, ok: false, later: 0 }, expression);
        const caught = kinds(out.trace, 'caught');
        assert.equal(caught.length, 1, expression);
        assert.equal(caught[0].reason ?? caught[0].code ?? caught[0].failure, 'DurationRange', `${expression}: ${JSON.stringify(caught[0])}`);
        assert.equal(kinds(out.trace, 'wait').length, 0, `${expression}: no wait`);
    }
    // Uncaught, it fails the activation like any runtime failure.
    const out = await run(wrap(`attribute d: uint = 0; operation f() { wait (d * 1ms); d = 1; } schedule { on start f(); }`), 1000);
    const failure = kinds(out.trace, 'failure')[0];
    assert.equal(failure.reason, 'DurationRange');
    assert.deepEqual(out.stores.Demo, { d: 0 });
    // A computed duration whose expiry leaves the clock is the ClockRange violation, as for literals.
    const clock = await run(wrap(`attribute d: uint = 9007199254740991; operation f() { wait 1ns; wait (d); } schedule { on start f(); }`), 10);
    assert.equal(clock.status, 'violation');
});

test('WP4-R02 a computed deadline is enforced at release plus its per-occurrence value', async () => {
    const out = await run(wrap(`const attribute periodMs: uint = 10; attribute busyMs: uint = 3; attribute n: uint = 0;
      operation work() { n = n + 1; wait (busyMs * 1ms); busyMs = busyMs + 1; }
      schedule { on every (periodMs * 1ms) work() deadline (periodMs * 1ms / 2); }`), 100000000);
    // Releases at 10, 20, 30 ms; busy 3, 4, 5 ms against a 5 ms deadline: the third misses it at 35 ms.
    assert.equal(out.status, 'violation');
    const violation = kinds(out.trace, 'violation')[0];
    assert.equal(violation.timeNs, 35000000);
    assert.equal(violation.reason ?? violation.code, 'Deadline');
});

test('WP4-R02 WP4-S04 (review F1) the deadline precedence is the same for every combination of literal and computed periods and deadlines', async () => {
    // op waits 15 ms: a 10 ms deadline is violated at 30 ms (release at 20 ms); the default deadline, the 20 ms period, is met.
    const combinations: [string, string, number | undefined][] = [
        ['20ms', '', undefined], ['20ms', 'deadline 10ms', 30000000], ['20ms', 'deadline (10ms)', 30000000], ['20ms', 'deadline (tenMs * 1ms)', 30000000],
        ['(20ms)', '', undefined], ['(twentyMs * 1ms)', '', undefined], ['(twentyMs * 1ms)', 'deadline 10ms', 30000000], ['(twentyMs * 1ms)', 'deadline (tenMs * 1ms)', 30000000],
    ];
    for (const [period, deadline, at] of combinations) {
        const source = wrap(`const attribute tenMs: uint = 10; const attribute twentyMs: uint = 20; attribute n: uint = 0;
      operation op() { wait 15ms; n = n + 1; }
      schedule { on every ${period} op() ${deadline}; }`);
        const r = await valid(source);
        const out = simulate([r.model], 'Test::Demo', { untilNs: 100000000 }), violation = kinds(out.trace, 'violation')[0];
        assert.deepEqual([out.status, violation?.timeNs], [at ? 'violation' : 'horizon', at], `every ${period} ${deadline}`);
        const expected = at ? 10000000 : 20000000;
        const projected = projectModel([r.model]).nodes.find(x => x.id === 'Test::Demo')!.schedule![0];
        assert.equal(projected.deadlineNs, expected, `projection of every ${period} ${deadline}`);
        const entry = nodesOf(r.model, a.isScheduleEntry)[0], usage = r.model.packages[0].elements.find(a.isComponentUsage)!;
        assert.equal(entryDeadline(entry, usage), expected);
    }
    // The validator compares the same values: a computed deadline above a literal period.
    assert.deepEqual(await errors(periodic('on every 10ms tick() deadline (periodMs * 2ms);')), [['SW2007', 'Periodic deadline cannot exceed its period in Demo.']]);
});

// ---------------------------------------------------------------- computed state timers

const machine = (states: string, attributes = '', more = '') => wrap(`${attributes}
      operation run() { ${states} }
      ${more}
      schedule { on start run(); }`);
test('WP4-S08 WP4-R02 a state timer is evaluated when the entry actions finish and uses the new delay (review counterexample)', async () => {
    const out = await run(machine(`
      state A { after 1ms exit; }
      state Backoff {
        on entry { delayMs = minInt(delayMs * 2, capMs); }
        after (delayMs * 1ms) exit;
      }
      state Connecting { on entry { tries = tries + 1; arrived = now(); } after 1ms to Backoff; }`, 'attribute delayMs: uint = 10; const attribute capMs: uint = 50; attribute tries: uint = 0; attribute arrived: uint = 0;'), 50000000);
    // 1 ms, then 20 ms (not the old 10), then 1 ms and 40 ms (not 20).
    const timers = kinds(out.trace, 'timer');
    assert.deepEqual(timers.map(t => [t.timeNs, t.state, t.timerNs, t.expiresNs, t.source]), [[1000000, 'Backoff', 20000000, 21000000, 'Test::D.run/1/1'], [22000000, 'Backoff', 40000000, 62000000, 'Test::D.run/1/1']]);
    assert.deepEqual(out.stores.Demo, { delayMs: 40, capMs: 50, tries: 1, arrived: 21000000 });
    // The timer observation follows the state observation of its entry and the entry's effects (WP4-T01).
    const i = out.trace.findIndex(t => t.kind === 'timer'), state = out.trace.slice(0, i).reverse().find(t => t.kind === 'state');
    assert.equal(state?.state, 'Backoff');
    assert.ok(out.trace.slice(out.trace.indexOf(state!), i).some(t => t.kind === 'write'), 'entry writes come before the timer');
    assert.deepEqual(Object.keys(timers[0]).sort(), ['expiresNs', 'kind', 'ordinal', 'source', 'state', 'subject', 'timeNs', 'timerNs']);
});

test('WP4-R02 a computed timer expires at the state-update time plus its value, also when entry suspends, and once per entry', async () => {
    // Entry waits 3 ms; the 5 ms timer expires 5 ms after the state update, not 8 ms.
    const suspended = await run(machine(`
      state A { on entry { wait 3ms; } after (delayMs * 1ms) { leftAt = now(); exit; } }
      state B { }`, 'attribute delayMs: uint = 5; attribute leftAt: uint = 0;'), 50000000);
    assert.equal(suspended.stores.Demo.leftAt, 5000000);
    // Entry suspends past expiry: the elapsed computed timer is selected on resumption.
    const past = await run(machine(`
      state A { on entry { wait 8ms; } after (delayMs * 1ms) { leftAt = now(); exit; } after 20ms to C; }
      state B { }
      return;
      state C { }`, 'attribute delayMs: uint = 5; attribute leftAt: uint = 0;'), 50000000);
    assert.equal(past.stores.Demo.leftAt, 8000000);
    // Discarded input does not re-evaluate the timer; a write by another operation meanwhile does not move it.
    const once = await run(`package Test {
  port def P { provides event m(); provides event set(v: uint); }
  component def D {
    reversed port p: P;
    attribute delayMs: uint = 10;
    attribute leftAt: uint = 0;
    operation setDelay(v: uint) { delayMs = v; }
    operation run() {
      state A { after (delayMs * 1ms) { leftAt = now(); exit; } on receive p.m() { if (false) exit; } }
      state B { }
    }
    schedule { on start run(); on receive p.set(v) setDelay(v); }
  }
  component def Env { port p: P; operation go() { wait 2ms; publish p.set(1); publish p.m(); } schedule { on start go(); } }
  component Demo: D;
  component env: Env;
  connect (env.p, Demo.p);
}`.replace('package Test {', 'package Test {\n  import Swaml::Time;'), 50000000, 'Test');
    assert.deepEqual([once.stores.Demo.leftAt, once.stores.Demo.delayMs], [10000000, 1]);
    assert.equal(kinds(once.trace, 'timer').length, 1);
    assert.equal(kinds(once.trace, 'discardInput').length, 1);
});

test('WP4-R02 re-entering a state re-evaluates its computed timer; equal expiries keep declaration order; literal timers add no observation', async () => {
    const out = await run(machine(`
      state A { on entry { n = n + 1; } after (n * 1ms) { path = path * 10 + 1; to A; } after 3ms { path = path * 10 + 2; exit; } }
      state B { }`, 'attribute n: uint = 0; attribute path: uint = 0;'), 50000000);
    // Timers 1 ms, 2 ms, then 3 ms ties with the literal 3 ms: the computed one is declared first.
    assert.deepEqual(kinds(out.trace, 'timer').map(t => [t.timeNs, t.timerNs]), [[0, 1000000], [1000000, 2000000], [3000000, 3000000], [6000000, 4000000]]);
    assert.equal(out.stores.Demo.path, 1112);
    const literal = await run(machine(`state A { after 1ms exit; } state B { }`), 10000000);
    assert.equal(kinds(literal.trace, 'timer').length, 0);
});

test('WP4-S08 a computed state timer is integral, pure or reads state (SW2008), and may fail with DurationRange', async () => {
    const component = (timer: string) => machine(`state A { after (${timer}) exit; } state B { }`, 'attribute n: uint = 1; attribute r: real = 1.0;', 'operation bump() returns uint { n = n + 1; return n; } operation peek() returns uint { return n; }');
    assert.deepEqual(await errors(component('peek() * 1ms')), []);
    assert.deepEqual(await errors(component('bump() * 1ms')), [['SW2008', 'State timers may only be pure or read state.']]);
    assert.deepEqual(await errors(component('r * 1ms')), [['SW2002', 'A duration must be integral, found real.']]);
    const out = await run(component('(n - 1) * 1ms'), 1000);
    assert.equal(kinds(out.trace, 'failure')[0]?.reason, 'DurationRange');
    // The failure ends the activation of the operation, which then has no current state (SIF-R13; 2.2 kept the machine live in A).
    assert.deepEqual(out.machines, { 'Demo.run': { state: 'A', live: false } });
});

// ---------------------------------------------------------------- constant sublanguage

const periodic = (entries: string, attributes = 'const attribute periodMs: uint = 10;', usages = '') => `package Test {
  import Swaml::Time;
  component def D {
    ${attributes}
    attribute n: uint = 0;
    operation tick() { n = n + 1; }
    operation tock() { n = n + 2; }
    operation helper() returns uint { return 1; }
    schedule { ${entries} }
  }
  component Demo: D;
  ${usages}
}`;
test('WP4-S05 WP4-D03 the constant sublanguage: literals, const attributes, arithmetic, comparisons and the conditional; no calls, state or now()', async () => {
    assert.deepEqual(await errors(periodic('on every (if (periodMs > 5 and not false) periodMs * 1ms + 0ns else 5ms) tick() deadline ((periodMs - 2 * 2) % 7 * 1ms);')), []);
    assert.deepEqual(await errors(periodic('on every (helper() * 1ms) tick();')), [['SW2007', 'helper() * 1ms is not a constant duration: calls are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every (try(helper(), 1) * 1ms) tick();')), [['SW2007', 'try(helper(), 1) * 1ms is not a constant duration: calls are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every (n * 1ms) tick();')), [['SW2007', 'n * 1ms is not a constant duration: mutable state are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every 10ms tick() deadline (now() + 1ms);')), [['SW2007', 'now() + 1ms is not a constant duration: now() are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every (if (mode == Mode.fast) 1ms else 2ms) tick();', 'const attribute mode: Mode = Mode.fast;').replace('component def D', 'enum Mode { fast, slow }\n  component def D')), [['SW2007', 'if (mode == Mode.fast) 1ms else 2ms is not a constant duration: values other than integers, durations and booleans are not allowed.']]);
    // A receive binding is not a const attribute.
    assert.ok((await errors(periodic('on receive p.m(v) tock() deadline (v * 1ms);', 'port p { requires event m(v: uint); }').replace('operation tock()', 'operation tock()'))).some(([c, m]) => c === 'SW2007' && m === 'v * 1ms is not a constant duration: mutable state are not allowed.'));
});

test('WP3-S01 WP4-S05 now() is not in the constant sublanguage (SW2007); isClockRead identifies it, a user operation named now does not', async () => {
    assert.deepEqual(await errors(periodic('on every (Swaml::Time::now() + 1ms) tick();')), [['SW2007', 'Swaml::Time::now() + 1ms is not a constant duration: now() are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every 1ms tick() deadline (now());')), [['SW2007', 'now() is not a constant duration: now() are not allowed.']]);
    assert.deepEqual(await errors(periodic('on every (now() * 1ms) tick();').replace('import Swaml::Time;', '').replace('operation helper()', 'operation now() returns uint { return 1; }\n    operation helper()')), [['SW2007', 'now() * 1ms is not a constant duration: calls are not allowed.']]);
});

test('WP4-S04 WP4-S05 WP4-D02 integral division is exact in the constant sublanguage; a non-integral period is rejected', async () => {
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline (periodMs * 1ms / 4);')), []);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline (periodMs * 1ms / 3);')), [['SW2013', 'periodMs * 1ms / 3 divides 10000000 by 3 in Demo, which is not an exact integral division.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms / (periodMs - 10)) tick();')), [['SW2013', 'periodMs * 1ms / (periodMs - 10) divides 10000000 by 0 in Demo, which is not an exact integral division.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms % 0) tick();')), [['SW2013', 'periodMs * 1ms % 0 takes the remainder of 10000000 by 0 in Demo, which is not defined for a zero divisor.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1.5) tick();')), [['SW2002', 'A duration must be integral, found real.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs > 1) tick();')), [['SW2002', 'A duration must be integral, found bool.']]);
});

test('WP4-S06 WP4-D04 WP4-D05 values are checked per expanded occurrence, after redefinition; an uninstantiated definition only for typing', async () => {
    const usage = (value: number, name = 'Other') => `component ${name}: D { redefines const attribute periodMs: uint = ${value}; }`;
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline (periodMs * 1ms / 2);', undefined, usage(4))), []);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline (periodMs * 1ms / 2);', undefined, usage(0))), [
        ['SW2013', 'period of on every (periodMs * 1ms) tick is 0 ns in Other; it must be a positive representable duration.'],
        ['SW2013', 'deadline of on every (periodMs * 1ms) tick is 0 ns in Other; it must be a positive representable duration.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline (periodMs / 2 * 1ms);', undefined, usage(3))), [['SW2013', 'periodMs / 2 divides 3 by 2 in Other, which is not an exact integral division.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick() deadline 8ms;', undefined, usage(5))), [['SW2007', 'Periodic deadline cannot exceed its period in Other.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1s) tick();', undefined, usage(10000000))), [['SW2013', 'period of on every (periodMs * 1s) tick is 10000000000000000 ns in Other; it must be a positive representable duration.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms - 20ms) tick();')), [['SW2013', 'period of on every (periodMs * 1ms - 20ms) tick is -10000000 ns in Demo; it must be a positive representable duration.']]);
    // Nested occurrences: a part family of a definition expands per element, each with the part's redefinition.
    const nested = `package Test {
  component def D { const attribute periodMs: uint = 10; attribute n: uint = 0; operation tick() { n = n + 1; } schedule { on every (periodMs * 1ms) tick() deadline (periodMs / 2 * 1ms); } }
  component def Host { component parts: D[2] { redefines const attribute periodMs: uint = 6; } }
  component def Unused { component part: D { redefines const attribute periodMs: uint = 0; } }
  component h: Host;
}`;
    assert.deepEqual(await errors(nested.replace('periodMs: uint = 6;', 'periodMs: uint = 7;')), [['SW2013', 'periodMs / 2 divides 7 by 2 in h.parts[0], which is not an exact integral division.']]);
    assert.deepEqual(await errors(nested), []);
    // A definition that is never instantiated: typing and membership only.
    assert.deepEqual(await errors(`package Test {
  component def D { const attribute periodMs: uint = 0; attribute n: uint = 0; operation tick() { n = n + 1; } schedule { on every (periodMs * 1ms) tick(); } }
}`), []);
    assert.deepEqual(await errors(`package Test {
  component def D { attribute periodMs: uint = 0; operation tick() { } schedule { on every (periodMs * 1ms) tick(); } }
}`), [['SW2007', 'periodMs * 1ms is not a constant duration: mutable state are not allowed.']]);
});

test('WP4-S07 WP4-M04 trigger identity is the canonical text; a parenthesized literal is its nanoseconds', async () => {
    assert.deepEqual(await errors(periodic('on every 20ms tick(); on every (20ms) tick();')), [['SW2007', 'Duplicate (trigger, operation) entry.']]);
    assert.deepEqual(await errors(periodic('on every (20000us) tick(); on every ((20 ms)) tick();')), [['SW2007', 'Duplicate (trigger, operation) entry.']]);
    assert.deepEqual(await errors(periodic('on every (periodMs * 1ms) tick(); on every (periodMs*1 ms /* the period */) tick();')), [['SW2007', 'Duplicate (trigger, operation) entry.']]);
    assert.deepEqual(await errors(periodic('on every 20ms tick(); on every (2 * 10ms) tick(); on every (periodMs * 2ms) tick();')), []);
    // Inheritance replacement by identity: the derived entry replaces the base entry written with other layout.
    const r = await valid(`package Test {
  component def Base { const attribute periodMs: uint = 10; attribute n: uint = 0; operation tick() { n = n + 1; } schedule { on every (periodMs * 1ms) tick(); on every 20ms tick(); } }
  component def Derived specializes Base { schedule { on every ( periodMs*1ms ) tick() deadline 2ms; on every (20ms) tick() deadline 3ms; } }
  component Demo: Derived;
}`);
    const derived = r.model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'Derived')!;
    const entries = schedule(derived);
    assert.deepEqual(entries.map(e => [triggerIdentity(e), e.deadline?.value]), [['periodMs * 1ms', 2], ['20000000', 3]]);
    assert.deepEqual(entries.map(entryKey), ['every:periodMs * 1ms:tick', 'every:20000000:tick']);
    // Names are canonical in the identity: a quoted basic name is the basic name.
    const quoted = await valid(periodic("on every ('periodMs' * 1ms) tick();"));
    assert.equal(triggerIdentity(nodesOf(quoted.model, a.isScheduleEntry)[0]), 'periodMs * 1ms');
    const out = simulate([r.model], 'Test::Demo', { untilNs: 20000000 });
    assert.equal(kinds(out.trace, 'release').length, 3, 'two entries: 10 and 20 ms, then 20 ms');
});

test('WP4-M02 one evaluator: constantValue per occurrence, entryPeriod and entryDeadline for consumers', async () => {
    const r = await valid(periodic('on every (periodMs * 1ms) tick() deadline (if (periodMs > 5) periodMs * 1ms / 2 else 1ms);', undefined, 'component Fast: D { redefines const attribute periodMs: uint = 4; }'));
    const pkg = r.model.packages[0], def = pkg.elements.find(a.isComponentDef)!, entry = schedule(def)[0];
    const demo = pkg.elements.find((e): e is a.ComponentUsage => a.isComponentUsage(e) && e.name === 'Demo')!, fast = pkg.elements.find((e): e is a.ComponentUsage => a.isComponentUsage(e) && e.name === 'Fast')!;
    assert.deepEqual([entryPeriod(entry, demo), entryDeadline(entry, demo), entryPeriod(entry, fast), entryDeadline(entry, fast), entryPeriod(entry, def)], [10000000, 5000000, 4000000, 1000000, 10000000]);
    assert.deepEqual(constantValue(entry.periodValue!, fast), { value: 4000000n });
    assert.equal(constantValue(entry.deadlineValue!, fast).value, 1000000n);
    assert.equal(expressionText(entry.deadlineValue!), 'if (periodMs > 5) periodMs * 1ms / 2 else 1ms');
    // Literal entries: the same functions; a non-every entry without a deadline has none.
    const literal = await valid(periodic('on every 20ms tick() deadline 5ms; on start tock();'));
    const [every, start] = schedule(literal.model.packages[0].elements.find(a.isComponentDef)!), usage = literal.model.packages[0].elements.find(a.isComponentUsage)!;
    assert.deepEqual([entryPeriod(every, usage), entryDeadline(every, usage), entryPeriod(start, usage), entryDeadline(start, usage)], [20000000, 5000000, undefined, undefined]);
    // The simulator releases per occurrence: 10 ms in Demo, 4 ms in Fast.
    const out = simulate([r.model], 'Test', { untilNs: 20000000 });
    assert.deepEqual([out.stores.Demo.n, out.stores.Fast.n], [2, 5]);
    // Membership problems name their kind.
    const bad = await parse(periodic('on every (helper() * 1ms) tick();'));
    const badEntry = nodesOf(bad.model, a.isScheduleEntry)[0];
    assert.equal(constantValue(badEntry.periodValue!, bad.model.packages[0].elements.find(a.isComponentUsage)!).problem?.kind, 'call');
    assert.equal(occurrences(bad.model.packages[0].elements.find(a.isComponentUsage)!).length, 1);
});

test('WP4-S04 WP4-S05 places, selectors and the conditional inside durations; a const bool selects the period per usage', async () => {
    const out = await run(wrap(`attribute delays: uint[3] = [1, 2, 3]; attribute cfg: R = record R { ms = 4; }; attribute fast: bool = true; attribute at: uint[3] = [0, 0, 0];
      operation f() { var i: uint = 1; wait (delays[i] * 1ms); at[0] = now(); wait (cfg.ms * 1ms); at[1] = now(); wait ((if (fast) 1 else 5) * 1ms); at[2] = now(); }
      schedule { on start f(); }`, 'datatype R { ms: uint; }'), 100000000);
    assert.deepEqual(out.stores.Demo.at, [2000000, 6000000, 7000000]);
    const r = await valid(periodic('on every (if (fast) 10ms else 20ms) tick();', 'const attribute fast: bool = true;', 'component Slow: D { redefines const attribute fast: bool = false; }'));
    const sim = simulate([r.model], 'Test', { untilNs: 40000000 });
    assert.deepEqual([sim.stores.Demo.n, sim.stores.Slow.n], [4, 2]);
});

// ---------------------------------------------------------------- SW2016

test('WP4-D06 SW2016 warns on a computed duration without a unit, not on literals, now() or const attributes with a duration initializer', async () => {
    const component = (op: string, entries = '') => wrap(`attribute n: uint = 250; const attribute pulseMs: uint = 250; const attribute timeoutNs: uint = 5ms; attribute stored: uint = 5ms;
      port p { requires event m(); }
      operation f() { ${op} }
      operation g() { }
      schedule { on start f(); ${entries} }`, 'port def Q { provides event m(); }');
    const sw2016 = async (op: string, entries = '') => (await warnings(component(op, entries))).filter(w => w[0] === 'SW2016').map(w => w[1]);
    assert.deepEqual(await sw2016('wait (n);'), ['n has no time unit and counts nanoseconds; multiply by a unit such as 1ms.']);
    assert.deepEqual(await sw2016('wait (pulseMs);'), ['pulseMs has no time unit and counts nanoseconds; multiply by a unit such as 1ms.']);
    assert.deepEqual(await sw2016('on receive p.m() { } or after (n + 1) { }'), ['n + 1 has no time unit and counts nanoseconds; multiply by a unit such as 1ms.']);
    assert.deepEqual(await sw2016('wait (250);'), ['250 has no time unit and counts nanoseconds; multiply by a unit such as 1ms.']);
    assert.deepEqual(await sw2016('wait 1ms;', 'on every (pulseMs) g() deadline (pulseMs / 2);'), ['pulseMs has no time unit and counts nanoseconds; multiply by a unit such as 1ms.', 'pulseMs / 2 has no time unit and counts nanoseconds; multiply by a unit such as 1ms.']);
    assert.deepEqual(await sw2016('wait (stored);'), ['stored has no time unit and counts nanoseconds; multiply by a unit such as 1ms.'], 'a mutable attribute does not carry its initializer');
    for (const op of ['wait (n * 1ms);', 'wait (timeoutNs);', 'wait (timeoutNs * 2);', 'wait (now() % 7 + 1);', 'wait 250ms;', 'on receive p.m() { } or after 2ms { }', 'wait (if (n > 1) 1ms else 2);'])
        assert.deepEqual(await sw2016(op), [], op);
    assert.deepEqual(await sw2016('wait 1ms;', 'on every (pulseMs * 1ms) g() deadline (timeoutNs);'), []);
    const states = machine('state A { after (pulseMs) exit; } state B { }','const attribute pulseMs: uint = 250;');
    assert.deepEqual((await warnings(states)).map(w => w[0]), ['SW2016']);
});

// ---------------------------------------------------------------- stale reads

test('WP1-M01 WP4-S03 SW2011 sees reads inside a computed wait and a computed timeout', async () => {
    const component = (op: string) => wrap(`attribute count: uint = 0; attribute delayMs: uint = 1;
      port p { requires event m(); }
      operation store(v: uint) returns uint { count = v; return 1; }
      operation f() { ${op} }
      operation tick() { count = count + 1; }
      schedule { on start f(); on every 1ms tick(); }`, 'port def Q { provides event m(); }');
    const stale = async (op: string) => (await warnings(component(op))).filter(w => w[0] === 'SW2011').length;
    assert.equal(await stale('var n: uint = count; wait 1ms; wait (store(n + 1) * 1ms);'), 1, 'a stale value written by a helper called in a computed wait');
    assert.equal(await stale('var n: uint = count; wait 1ms; on receive p.m() { } or after (store(n) * 1ms) { }'), 1);
    assert.equal(await stale('wait (delayMs * 1ms); count = count + 1;'), 0, 'the computed wait reads before it suspends; the write reads again');
    assert.equal(await stale('var n: uint = count; wait (delayMs * 1ms); count = n;'), 1, 'a computed wait suspends like a literal one');
});

// ---------------------------------------------------------------- projections and the formatter

test('WP4-M03 projections show computed periods per occurrence and the expression text; transitions label computed timers', async () => {
    const r = await valid(periodic('on every (periodMs * 1ms) tick() deadline (periodMs * 1ms / 2); on every 5ms tock();', undefined, 'component Fast: D { redefines const attribute periodMs: uint = 4; } component def M { attribute d: uint = 1; operation run() { state A { after (d * 1ms) to B; } state B { after 2ms to A; } } schedule { on start run(); } } component m: M;'));
    const p = projectModel([r.model]), node = (id: string) => p.nodes.find(n => n.id === id)!;
    assert.deepEqual(node('Test::D').schedule!.map(e => [e.periodNs, e.deadlineNs, e.periodExpression, e.deadlineExpression]), [[undefined, undefined, 'periodMs * 1ms', 'periodMs * 1ms / 2'], [5000000, 5000000, undefined, undefined]]);
    assert.deepEqual(node('Test::Demo').schedule!.map(e => [e.periodNs, e.deadlineNs, e.periodExpression]), [[10000000, 5000000, 'periodMs * 1ms'], [5000000, 5000000, undefined]]);
    assert.deepEqual(node('Test::Fast').schedule!.map(e => [e.periodNs, e.deadlineNs]), [[4000000, 2000000], [5000000, 5000000]]);
    assert.ok(!('periodExpression' in node('Test::Fast').schedule![1]), 'literal entries gain no field');
    assert.deepEqual(p.edges.filter(e => e.kind === 'transition').map(e => e.label), ['after (d * 1ms)', 'after 2ms', 'after (d * 1ms)', 'after 2ms'], 'the definition and its occurrence');
});

test('WP4-M08 the formatter prints computed durations in parentheses and literal durations without them', async () => {
    const services = createSwamlServices(EmptyFileSystem), parseOnly = parseHelper<Model>(services.Swaml);
    const source = wrap(`const attribute periodMs: uint = 10; attribute n: uint = 1;
 operation f() { wait(n*1ms); wait 5 ms; wait   (  -n*1ms+5ms ); }
 operation g() { state A { after(n * 2ms)to B ; } state B { after 1 ms to A; } }
 schedule { on start f(); on start g(); on every(periodMs*1ms)f()deadline(periodMs * 1ms/2); on every 20 ms g(); }`);
    const once = formatDocument(await parseOnly(source));
    assert.match(once, /wait \(n \* 1ms\);/);
    assert.match(once, /wait 5ms;/);
    assert.match(once, /wait \(-n \* 1ms \+ 5ms\);/);
    assert.match(once, /after \(n \* 2ms\) to B;/);
    assert.match(once, /after 1ms to A;/);
    assert.match(once, /on every \(periodMs \* 1ms\) f\(\) deadline \(periodMs \* 1ms \/ 2\);/);
    assert.match(once, /on every 20ms g\(\);/);
    assert.equal(formatDocument(await parseOnly(once)), once, 'idempotent');
    const timeout = formatDocument(await parseOnly(wrap('port p { requires event m(); } operation f() { on receive p.m() { } or after(n*1ms){ } } attribute n: uint = 1;', 'port def Q { provides event m(); }')));
    assert.match(timeout, /\} or after \(n \* 1ms\) \{/);
    for (const file of ['examples/41-computed-backoff.swaml', 'examples/42-lock-pulse.swaml', 'examples/43-derived-period.swaml']) {
        const { readFileSync } = await import('node:fs');
        const text = readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n');
        assert.equal(formatDocument(await parseOnly(text)), text, `${file} is canonical`);
    }
});

test('WP4-S07 (review F3, F4) display text keeps the source spelling; identity text is collision-free', async () => {
    const r = await parse(periodic("on every (arr[0] * 1ms + (periodMs - 1) * 2ms) tick() deadline (3ms); on every (try(helper(), 1) * 1ms) tock();", 'const attribute periodMs: uint = 10; const attribute arr: uint[2] = [1, 2];'));
    const [first, second] = nodesOf(r.model, a.isScheduleEntry);
    assert.equal(displayText(first.periodValue!), 'arr[0] * 1ms + (periodMs - 1) * 2ms');
    assert.equal(displayText(first.deadlineValue!), '3ms');
    assert.equal(expressionText(first.deadlineValue!), '3000000', 'identity of a single literal is its nanoseconds');
    assert.equal(displayText(second.periodValue!), 'try(helper(), 1) * 1ms');
    assert.ok(r.errors.some(e => e.message === 'arr[0] * 1ms + (periodMs - 1) * 2ms is not a constant duration: values other than integers, durations and booleans are not allowed.'), JSON.stringify(r.errors.map(e => e.message)));
    const projected = projectModel([r.model]).nodes.find(x => x.id === 'Test::D')!.schedule![0];
    assert.equal(projected.deadlineExpression, '3ms');
    // a or b and a name aorb, a [1] array and a[1] index stay apart.
    const pair = await parse(periodic('on every (if (a or b) 1ms else 2ms) tick(); on every (if (aorb) 1ms else 2ms) tick();', 'const attribute a: bool = true; const attribute b: bool = false; const attribute aorb: bool = true;'));
    const [x, y] = nodesOf(pair.model, a.isScheduleEntry);
    assert.notEqual(triggerIdentity(x), triggerIdentity(y));
    assert.deepEqual(pair.errors, []);
});

test('WP4-D07 (review F5) a remainder by zero has its own wording', async () => {
    assert.deepEqual(await errors(periodic('on every (periodMs % (periodMs - 10) * 1ms + 1ms) tick();')), [['SW2013', 'periodMs % (periodMs - 10) takes the remainder of 10 by 0 in Demo, which is not defined for a zero divisor.']]);
});

test('WP4-D01 WP4-S08 (review F6) one diagnostic per cause on the new forms; a missing duration expression has a short syntax message', async () => {
    assert.deepEqual(await errors(policy('capacity = 4; requestTimeout = 1s; delivery = 5ms * 2;').replace('delivery = Delivery.atMostOnce; ', '')), [['SW2013', 'A policy needs complete valid delivery, ordering, capacity, overflow and requestTimeout.'], ['SW2013', 'delivery is not a duration setting.']]);
    const unknown = await errors(machine('state A { after (nope() * 1ms) exit; } state B { }'));
    assert.ok(!unknown.some(([c]) => c === 'SW2008'), JSON.stringify(unknown));
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const [line, keyword] of [['wait ();', 'wait'], ['on receive p.m() { } or after () { }', 'after']])
        assert.deepEqual(Swaml.parser.LangiumParser.parse(statement(line)).parserErrors.map(e => e.message), [`Expecting a duration expression after ${keyword} (, such as ${keyword} (n * 1ms), but found \`)\`.`]);
    assert.deepEqual(Swaml.parser.LangiumParser.parse(entry('on every () g();')).parserErrors.map(e => e.message), ['Expecting a duration expression after every (, such as every (n * 1ms), but found `)`.']);
    assert.match(Swaml.parser.LangiumParser.parse(statement('x = ();')).parserErrors[0].message, /^Expecting: one of these possible Token sequences/u, 'the 2.2 message of an empty parenthesis is unchanged');
});

test('WP4-D08 (review F8) SW2019 warns when entries with different triggers have equal periods in an occurrence; literal periods keep 2.2 value identity', async () => {
    const source = `package Test {
  component def Base { const attribute periodMs: uint = 10; attribute n: uint = 0; operation g() { n = n + 1; } schedule { on every 20ms g(); } }
  component def Derived specializes Base { schedule { on every (2 * 10ms) g(); } }
  component Demo: Derived;
}`;
    assert.deepEqual(await warnings(source), [['SW2019', 'on every (2 * 10ms) g and on every 20ms g have the same period in Demo but different triggers, so neither replaces the other and g is released twice per period; write the same trigger to replace an entry.']]);
    // Literal periods written in different units are one trigger, as in 2.2: replaced, no warning.
    const literal = `package Test {
  component def Base { attribute n: uint = 0; operation g() { n = n + 1; } schedule { on every 20ms g(); } }
  component def Derived specializes Base { schedule { on every 20000us g(); } }
  component Demo: Derived;
}`;
    assert.deepEqual(await warnings(literal), []);
    const r = await valid(literal);
    assert.equal(schedule(r.model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'Derived')!).length, 1);
    // Equal only in one occurrence: the warning names that occurrence.
    const perUsage = `package Test {
  component def D { const attribute periodMs: uint = 10; attribute n: uint = 0; operation g() { n = n + 1; } schedule { on every 20ms g(); on every (periodMs * 1ms) g(); } }
  component a: D;
  component b: D { redefines const attribute periodMs: uint = 20; }
}`;
    assert.deepEqual((await warnings(perUsage)).map(w => String(w[1]).split(' but')[0]), ['on every (periodMs * 1ms) g and on every 20ms g have the same period in b']);
});

// ---------------------------------------------------------------- recovery

const statement = (line: string) => `package Test {
  port def P { requires event m(); }
  component def D {
    attribute x: int = 0;
    port p: P;
    operation run() {
      x = 1;
      ${line}
      x = 2;
      x = 3;
    }
    operation other() { x = 4; }
    schedule { on start run(); }
  }
  component Demo: D;
}
package After { }`;
const state = (line: string) => `package Test {
  component def D {
    attribute x: int = 0;
    operation run() {
      state A {
        ${line}
        after 1ms exit;
      }
      state B { after 2ms exit; }
      state C { }
    }
    operation other() { x = 4; }
    schedule { on start run(); }
  }
  component Demo: D;
}
package After { }`;
const entry = (line: string) => `package Test {
  component def D {
    attribute x: int = 0;
    operation f() { }
    operation g() { }
    operation other() { x = 4; }
    schedule {
      on start f();
      ${line}
      on every 5ms g();
    }
  }
  component Demo: D;
}
package After { }`;
const setting = (line: string) => `package Test {
  qos def P: Swaml::Qos::Policy {
    delivery = Swaml::Qos::Delivery.atMostOnce;
    ${line}
    capacity = 4;
  }
  component def D { attribute x: int = 0; operation other() { x = 4; } }
  component Demo: D;
}
package After { }`;
const keptItems = (m: Model) => ({
    packages: m.packages.map(p => p.name),
    elements: m.packages.flatMap(p => p.elements.map(e => (e as { name?: string }).name)).filter(n => ['D', 'Demo', 'P'].includes(n ?? '')),
    statements: AstUtils.streamAllContents(m).filter(a.isAssign).map(n => n.$cstNode?.text).filter(t => /^x = [234];$/.test(t ?? '')).toArray(),
    operations: AstUtils.streamAllContents(m).filter(a.isOperation).map(n => n.name).filter(n => n === 'other').toArray(),
    states: AstUtils.streamAllContents(m).filter(a.isStateStep).map(n => n.name).filter(n => ['B', 'C'].includes(n)).toArray(),
    entries: AstUtils.streamAllContents(m).filter(a.isScheduleEntry).filter(e => e.kind === 'start' || e.kind === 'every' && e.period?.value === 5).map(e => e.operation).filter(op => op === 'f' || op === 'g').toArray(),
    settings: AstUtils.streamAllContents(m).filter(a.isPolicySetting).map(n => n.name).filter(n => n === 'capacity').toArray(),
});
// Each unfinished or malformed duration form, paired with the nearest 2.2 form of the same position: an unfinished
// parenthesis is compared with an unfinished parenthesized 2.2 expression or argument list, a malformed literal
// with the 2.2 literal form. States in the flow are not 2.2 text: a half-typed timer, event line, if or jump in a state
// is paired with the nearest half-typed statement of the current grammar in the same place, which is its reference.
const recovery: [(line: string) => string, [string, string][]][] = [
    [statement, [['wait (', 'x = ('], ['wait (x *', 'x = (x *'], ['wait (x * 1ms', 'x = (x * 1'], ['wait (x * 1ms)', 'wait 5'], ['wait ();', 'wait ;'], ['wait (5m);', 'x = (5m);'],
        ['wait 5m;', 'wait 5m;'], ['x = 5m;', 'x = 5m;'], ['x = 5ms', 'x = 5'], ['x = 5 ms * ;', 'x = 5 * ;'], ['on receive p.m() { } or after (', 'x = ('],
        ['on receive p.m() { } or after (x * 1ms {', 'on receive p.m() { } or after 5 {'], ['on receive p.m() { } or after (x * 1ms) ', 'on receive p.m() { } or after 5 '], ['on receive p.m() { } or after () { }', 'on receive p.m() { } or after { }']]],
    [state, [['after (', 'x = ('], ['after (x * 1ms', 'x = (x * 1'], ['after (x * 1ms) to', 'if (x > 1) to'], ['after (x * 1ms) to B', 'if (x > 1) to B'], ['after () exit;', 'x = ();'], ['after (5m) exit;', 'x = (5m);'],
        ['on receive p.m(', 'x = p.m('], ['if (x', 'x = (x'], ['if (x > 1) exit; else to', 'if (x > 1) to'], ['to B', 'x = 5'], ['after 5ms', 'x = 5']]],
    [entry, [['on every (', 'on start g('], ['on every (x * 1ms', 'on start g(x /'], ['on every (x * 1ms) g(', 'on every 10ms g('], ['on every (x * 1ms g();', 'on start g(x / 2;'], ['on every 10ms g() deadline (x /', 'on start g(x /'],
        ['on every 10ms g() deadline (', 'on start g('], ['on every 10ms g() deadline (x / 2;', 'on start g(x / 2;'], ['on every (5m) g();', 'on every 5m g();'], ['on every () g();', 'on every g();']]],
    [setting, [['requestTimeout = ;', 'requestTimeout = ;'], ['requestTimeout = 5m;', 'requestTimeout = 5m;'], ['requestTimeout = (1s;', 'requestTimeout = (1;'], ['requestTimeout = 1s * ;', 'requestTimeout = 1 * ;'], ['requestTimeout = 5ms', 'requestTimeout = 5'], ['requestTimeout = (', 'requestTimeout = ('], ['requestTimeout =', 'requestTimeout =']]],
];
test('WP4-G01 WP4-G02 WP4-G03 WP4-G04 an unfinished or malformed duration keeps every following statement, member, entry and package that the kept 2.2 grammar keeps', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const [context, pairs] of recovery)
        for (const [line, nearest] of pairs) {
            const reference = context === state ? Swaml.parser.LangiumParser : old;
            const text = context(line), now = Swaml.parser.LangiumParser.parse(text), before = reference.parse(text), near = reference.parse(context(nearest));
            const count = now.parserErrors.length + now.lexerErrors.length, limit = Math.max(1, before.parserErrors.length + before.lexerErrors.length, near.parserErrors.length + near.lexerErrors.length);
            assert.ok(count > 0, `${line} is a syntax error`);
            assert.ok(count <= limit, `${line}: ${count} errors, 2.2 had ${limit}`);
            const kept = keptItems(now.value as Model);
            for (const [label, reference] of [['the same text', keptItems(before.value as Model)], [nearest, keptItems(near.value as Model)]] as const)
                for (const [key, values] of Object.entries(reference))
                    for (const value of values as (string | undefined)[])
                        assert.ok((kept as Record<string, (string | undefined)[]>)[key].includes(value), `${line}: ${key} ${value} is kept by the 2.2 grammar for ${label} but not now: ${JSON.stringify(kept)}`);
            assert.deepEqual(kept.packages, ['Test', 'After'], line);
            assert.ok(kept.operations.includes('other') && kept.elements.includes('Demo'), line);
        }
});
nodeTest('SIF-G01 a half-typed jump standing in a state keeps the following items, states and members', () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const line of ['to', 'exit; to']) {
        const now = Swaml.parser.LangiumParser.parse(state(line)), kept = keptItems(now.value as Model);
        assert.ok(now.parserErrors.length <= 1 && kept.states.includes('B') && kept.operations.includes('other') && kept.elements.includes('Demo'), `${line}: ${now.parserErrors.length} errors, ${JSON.stringify(kept)}`);
    }
});

test('WP4-G03 WP4-G04 (gate 3) the new forms parse without console output, and a valid source using every form validates', async () => {
    const logged: string[] = [], saved = [console.log, console.warn, console.error];
    console.log = console.warn = console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
    try {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const [context, pairs] of recovery)
            for (const [line] of pairs)
                Swaml.parser.LangiumParser.parse(context(line));
    }
    finally {
        [console.log, console.warn, console.error] = saved;
    }
    assert.deepEqual(logged, []);
});

// ---------------------------------------------------------------- examples and determinism

test('WP4 examples: computed backoff, lock pulse and derived period pass their cases, deterministically', async () => {
    const { readFileSync } = await import('node:fs');
    const expected: Record<string, string[]> = {
        'examples/41-computed-backoff.swaml': ['Backoff::Counted loop rounds up', 'Backoff::Computed wait is exact', 'Backoff::A delay that is not positive fails', 'Backoff::Timeout doubles after a loss', 'Backoff::Backoff timer uses the new delay'],
        'examples/42-lock-pulse.swaml': ['LockPulse::Recalibrated pulse'],
        'examples/43-derived-period.swaml': ['DerivedPeriod::Period per usage', 'DerivedPeriod::Busy within the deadline', 'DerivedPeriod::Deadline per usage'],
    };
    for (const [file, cases] of Object.entries(expected)) {
        const r = await parse(readFileSync(new URL(file, root), 'utf8'));
        assert.deepEqual(r.doc.diagnostics?.map(d => [d.code, d.message]), [], file);
        for (const name of cases) {
            const first = runCase([r.model], name, { untilNs: 10000000000 }), second = runCase([r.model], name, { untilNs: 10000000000 });
            // The derived deadline of late (4 ms) is violated by design at 12 ms (WP4-R02, review F1).
            if (name === 'DerivedPeriod::Deadline per usage') {
                assert.equal(first.result, 'fail');
                const violation = (first.run?.trace ?? []).find(t => t.kind === 'violation') as Observation | undefined;
                assert.deepEqual([first.run?.status, violation?.timeNs, violation?.reason ?? violation?.code], ['violation', 12000000, 'Deadline'], JSON.stringify(violation));
            }
            else
                assert.equal(first.result, 'pass', `${name}: ${first.message}`);
            // A non-positive delay is DurationRange, not Bounds (review F2).
            if (name === 'Backoff::A delay that is not positive fails')
                assert.deepEqual(kinds(first.run!.trace, 'caught').map(t => t.reason), ['DurationRange', 'DurationRange']);
            assert.equal(JSON.stringify(first.run?.trace), JSON.stringify(second.run?.trace), `${name} is deterministic`);
        }
    }
});

test('WP4-T01 2.2 forms add nothing to traces: a model of literal durations has no durationNs field and no timer observation', async () => {
    const out = await run(machine('state A { on entry { wait 1ms; } after 2ms exit; } state B { on receive p.m() to A; }', 'port p { requires event m(); requires event k(); }', 'operation pulse() { wait 3 ms; on receive p.k() { } or after 1ms { } } schedule { on every 10ms pulse() deadline 5ms; }').replace('schedule { on every 10ms pulse() deadline 5ms; }', '').replace('schedule { on start run(); }', 'schedule { on start run(); on every 10ms pulse() deadline 5ms; }').replace('component Demo: D;', `component Demo: D;
  component def S { port q: P; operation g() { if (false) { publish q.m(); publish q.k(); } } schedule { on start g(); } }
  component s: S;
  connect (s.q, Demo.p);`).replace('import Swaml::Time;', 'import Swaml::Time;\n  port def P { provides event m(); provides event k(); }'), 50000000);
    assert.ok(out.trace.length > 10);
    assert.ok(out.trace.every(t => !('durationNs' in t) && t.kind !== 'timer'), JSON.stringify(out.trace.filter(t => 'durationNs' in t || t.kind === 'timer')));
});

void invalid; void diagnostics;
