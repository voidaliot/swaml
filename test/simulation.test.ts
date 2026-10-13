import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';
const fixture = (name: string) => readFileSync(new URL(`../../examples/${name}.swaml`, import.meta.url), 'utf8');
async function run(text: string, system: string = 'P::S', options: SimulationOptions = { untilNs: 1000000000 }) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const d = await parseHelper<Model>(Swaml)(text, { validation: true });
    assert.deepEqual(d.diagnostics, [], JSON.stringify(d.diagnostics));
    return simulate([d.parseResult.value], system, options);
}
const failed = (r: Awaited<ReturnType<typeof run>>, code: string) => r.trace.some(t => ['failure', 'violation'].includes(t.kind) && t.code === code);
const program = (body: string, vars = '') => `swaml "1.0"; package P { unit def U { ${vars} operation run(): Void on start { ${body} } } component def C { unit u: U; } system S service { component c: C; } }`;

test('hello routes copied data through delegated boundaries', async () => {
    const r = await run(fixture('01-hello'), 'Hello::Demo');
    assert.ok(Object.values(r.stores).some(s => s.last === 'Hello, SWAML'));
    assert.equal(r.status, 'quiescent');
});
test('records, enums, arrays, pure functions, branches, loops and local invoke execute', async () => {
    const r = await run(fixture('05-values-and-flow'), 'Values::Demo');
    assert.equal(r.stores['pipeline.consumer'].latest, 6);
    assert.equal(r.trace.filter(x => x.kind === 'delivery').length, 3);
});
test('periodic realtime model and effective allocation', async () => {
    const r = await run(fixture('02-realtime-controller'), 'Control::Heating', { untilNs: 30000000 });
    assert.equal(r.stores['controller.actuator'].applied, 0.235);
    assert.equal(r.deployments['controller.actuator'], 'ecu');
    assert.equal(r.trace.filter(x => x.kind === 'emission').length, 6);
    assert.equal(r.status, 'horizon');
});
test('service RPC completion unblocks serial callback and independent pubsub', async () => {
    const r = await run(fixture('03-service-pubsub'), 'Commerce::Shop', { untilNs: 3000000000, manual: [{ atNs: 0, operation: 'web.frontend.checkout' }] });
    assert.equal(r.stores['web.frontend'].lastAccepted, 'order-42');
    assert.equal(r.stores['archive.store'].last, 'order-42');
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.state === 'Succeeded'));
    assert.ok(!r.trace.some(t => t.kind === 'failure'));
});
test('stateful operation receives events and expires timer', async () => {
    const r = await run(fixture('04-stateful-operation'), 'Lifecycle::Product', { untilNs: 31000000000, manual: [{ atNs: 1, operation: 'assembly.operatorUnit.startDevice' }] });
    assert.deepEqual(r.machines['assembly.device.lifecycle'], { state: 'Stopped', live: false });
    assert.equal(r.stores['assembly.device'].cycles, 1);
    assert.equal(r.stores['assembly.monitor'].current, 'stopped');
});
test('whole-value assignment preserves scalar Real widening and avoids integer overflow semantics', async () => {
    const r = await run(program('let x: Real = 9007199254740991; set x = x + 1; assert x > 9007199254740991;'));
    assert.ok(!failed(r, 'Arithmetic'));
});

for (const [name, body, code] of [
    ['Int addition overflow', 'let x: Int = 9007199254740991; set x = x + 1;', 'Arithmetic'],
    ['Int multiplication overflow', 'let x: Int = 9007199254740991; set x = x * 2;', 'Arithmetic'],
    ['division by zero', 'let x: Real = 1 / 0;', 'Arithmetic'],
    ['negative remainder uses dividend sign', 'assert -5 % 2 == -1;', ''],
    ['computed bounds', 'let x: Int[2] = array [1, 2]; let i: Int = 2; let y: Int = x[i];', 'Bounds'],
    ['loop protection', 'while (true) bound 2 { assert true; }', 'LoopBound'],
    ['assertion', 'assert false;', 'Assertion'],
    ['short circuit avoids division', 'assert true or (1 / 0 == 0); assert not (false and (1 / 0 == 0));', ''],
    ['Unicode and escaped string equality', 'assert "a\\nβ" == "a\\nβ";', ''],
] as const) test(name, async () => {
    const r = await run(program(body));
    if (code) assert.ok(failed(r, code), JSON.stringify(r.trace)); else assert.ok(!r.trace.some(t => t.kind === 'failure'));
});
test('record equality ignores literal field order; record/array payloads are copied', async () => {
    const source = program('let a: T = record T { x = 1; y = 2; }; let b: T = record T { y = 2; x = 1; }; assert a == b; let c: T = a; set a = record T { x = 3; y = 4; }; assert c.x == 1;').replace('unit def U', 'datatype T { x: Int; y: Int; } unit def U');
    assert.ok(!(await run(source)).trace.some(t => t.kind === 'failure'));
});
test('two occurrences never share mutable stores', async () => {
    const r = await run(fixture('08-service-field'), 'Settings::Cabin', { untilNs: 1000000000, manual: [{ atNs: 0, operation: 'front.panel.adjust' }] });
    assert.equal(r.stores['settings.store'].currentValue, 22);
    assert.equal(r.stores['front.panel'].displayed, 22);
    assert.equal(r.stores['rear.panel'].displayed, 22);
});
test('timeout wins equal-time reply and late response has no second completion', async () => {
    const text = fixture('03-service-pubsub').replace('within 2 s', 'within 2 ns');
    const r = await run(text, 'Commerce::Shop', { untilNs: 10, latencyNs: 1, manual: [{ atNs: 0, operation: 'web.frontend.checkout' }] });
    const completions = r.trace.filter(t => t.kind === 'requestComplete');
    assert.equal(completions.length, 1); assert.equal(completions[0].failure, 'Timeout');
    assert.ok(r.trace.some(t => t.kind === 'discardResponse'));
    assert.equal(r.stores['archive.store'].last, 'order-42');
});
test('response strictly before timeout succeeds', async () => {
    const r = await run(fixture('03-service-pubsub').replace('within 2 s', 'within 3 ns'), 'Commerce::Shop', { untilNs: 10, latencyNs: 1, manual: [{ atNs: 0, operation: 'web.frontend.checkout' }] });
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.state === 'Succeeded'));
});
test('remote failures follow the originating correlation', async () => {
    const r = await run(fixture('03-service-pubsub').replace('return true;', 'fail "server rejected";'), 'Commerce::Shop', { untilNs: 3000000000, manual: [{ atNs: 0, operation: 'web.frontend.checkout' }] });
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.failure === 'RemoteFailure'));
});
test('best effort loss is observable', async () => {
    const r = await run(fixture('01-hello').replace('atMostOnce', 'bestEffort'), 'Hello::Demo', { untilNs: 10, faults: [{ offer: 1, kind: 'drop' }] });
    assert.equal(r.stores['conversation.listener'].last, '');
    assert.ok(r.trace.some(t => t.kind === 'drop' && t.reason === 'InjectedLoss'));
});
test('atLeastOnce retry keeps identity and duplicate delivery is observable', async () => {
    const text = fixture('01-hello').replace('atMostOnce', 'atLeastOnce');
    const r = await run(text, 'Hello::Demo', { untilNs: 10, faults: [{ offer: 1, kind: 'duplicate' }] });
    const deliveries = r.trace.filter(t => t.kind === 'delivery');
    assert.equal(deliveries.length, 2); assert.equal(deliveries[0].subject, deliveries[1].subject);
    assert.equal(deliveries[1].attempt, 2);
    const retry = await run(text, 'Hello::Demo', { untilNs: 10, faults: [{ offer: 1, kind: 'drop' }] });
    assert.ok(retry.trace.some(t => t.kind === 'retry'));
    assert.equal(retry.stores['conversation.listener'].last, 'Hello, SWAML');
});
test('manual harness cannot call a non-manual operation', async () => {
    await assert.rejects(() => run(fixture('01-hello'), 'Hello::Demo', { untilNs: 0, manual: [{ atNs: 0, operation: 'conversation.speaker.greet' }] }), /on manual/);
});
test('unbound optional RPC runs explicit Unavailable failure block', async () => {
    const source = `swaml "1.0"; package P { interface clientServer API version "1.0.0" { operation ping(): Void; } unit def U { port api: API client optional; var result: String = ""; operation run(): Void on start { request api.ping() as completionValue within 1 ns otherwise { set result = failure; return; }; } } component def C { unit u: U; } system S service { component c: C; } }`;
    assert.equal((await run(source)).stores['c.u'].result, 'Unavailable');
});
test('machine priority, payload effects and entry scopes', async () => {
    const text = fixture('04-stateful-operation').replace('event begin();', 'event begin(value: Int);').replace('commands.begin();', 'commands.begin(7);').replace('on receive commands.begin {}', 'on receive commands.begin when (value == 7) priority 2 { set cycles = value; } transition other: Idle -> Stopped on receive commands.begin priority 1 {}');
    const r = await run(text, 'Lifecycle::Product', { untilNs: 10, manual: [{ atNs: 0, operation: 'assembly.operatorUnit.startDevice' }] });
    assert.equal(r.stores['assembly.device'].cycles, 8); assert.equal(r.machines['assembly.device.lifecycle'].state, 'Running');
});
test('machine timer cancellation and post-final input are observable', async () => {
    const r = await run(fixture('04-stateful-operation'), 'Lifecycle::Product', { untilNs: 31000000000, manual: [{ atNs: 1, operation: 'assembly.operatorUnit.startDevice' }, { atNs: 2, operation: 'assembly.operatorUnit.stopDevice' }, { atNs: 3, operation: 'assembly.operatorUnit.startDevice' }] });
    assert.ok(r.trace.some(t => t.kind === 'discardTimer'));
    assert.ok(r.trace.some(t => t.kind === 'drop' && t.reason === 'Undeliverable'));
    assert.ok(!r.trace.some(t => t.kind === 'transition' && t.transition === 'expire'));
});
test('guarded completion cycle fails on the 1025th edge', async () => {
    const source = `swaml "1.0"; package P { unit def U { operation run(): Void on start machine { initial A; state A {} transition cycle: A -> A on completion when (true) {} } } component def C { unit u: U; } system S service { component c: C; } }`;
    const r = await run(source);
    assert.ok(failed(r, 'MicrostepLimit')); assert.equal(r.trace.filter(t => t.kind === 'transition').length, 1024);
});
test('step budget stops a run explicitly', async () => {
    const r = await run(program('while (true) bound 100000 { assert true; }'), 'P::S', { untilNs: 10, maxSteps: 10 });
    assert.equal(r.status, 'limit');
});
test('latency bound violation stops execution', async () => {
    const r = await run(fixture('02-realtime-controller'), 'Control::Heating', { untilNs: 20000000, latencyNs: 2000000 });
    assert.equal(r.status, 'violation'); assert.ok(failed(r, 'Latency'));
});
test('rejects a workspace with static errors', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const d = await parseHelper<Model>(Swaml)('swaml "9.0";', { validation: true });
    assert.throws(() => simulate([d.parseResult.value], 'P::S', { untilNs: 1 }), /validated/);
});

for (const [overflow, expected] of [['dropOldest', 6], ['dropNewest', 2], ['reject', 2]] as const) test(`queue capacity and ${overflow}`, async () => {
    const text = fixture('05-values-and-flow').replace('capacity 3; overflow reject', `capacity 1; overflow ${overflow}`);
    const r = await run(text, 'Values::Demo', { untilNs: 20, latencyNs: 10 });
    assert.equal(r.stores['pipeline.consumer'].latest, expected);
    assert.equal(failed(r, 'Rejected'), overflow === 'reject');
});
test('fanout continues offering other routes after one rejects', async () => {
    const text = fixture('05-values-and-flow').replace('unit consumer: Consumer;', 'unit consumer: Consumer; unit other: Consumer; connect otherSamples: producer.output -> other.input qos { delivery atMostOnce; ordering fifo; capacity 3; overflow reject; };').replace('capacity 3; overflow reject; };\n    }', 'capacity 1; overflow reject; };\n    }');
    const r = await run(text, 'Values::Demo', { untilNs: 20, latencyNs: 10 });
    assert.ok(failed(r, 'Rejected')); assert.equal(r.stores['pipeline.other'].latest, 4);
});
for (const delay of [1, 2]) test(`freshness is inclusive at maxAge: latency ${delay}`, async () => {
    const text = fixture('01-hello').replace('capacity 4; overflow reject;', 'capacity 4; overflow reject; maxAge 1 ns;');
    const r = await run(text, 'Hello::Demo', { untilNs: 10, latencyNs: delay });
    assert.equal(r.stores['conversation.listener'].last, delay === 1 ? 'Hello, SWAML' : '');
});
test('atLeastOnce RPC duplicates execute but caller completes once', async () => {
    const r = await run(fixture('07-client-server'), 'Rpc::HealthCheck', { untilNs: 1100000000, faults: [{ offer: 1, kind: 'duplicate' }] });
    assert.equal(r.trace.filter(t => t.kind === 'requestComplete').length, 1);
    assert.equal(r.trace.filter(t => t.kind === 'dispatch' && t.operation === 'serviceUnit.serverUnit.checkHealth').length, 2);
    assert.ok(r.trace.some(t => t.kind === 'discardResponse'));
});
test('request transport failure is an explicit failure outcome', async () => {
    const r = await run(fixture('07-client-server'), 'Rpc::HealthCheck', { untilNs: 1100000000, faults: [{ offer: 1, kind: 'transport' }] });
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.failure === 'Transport'));
});
test('bounded periodic backlog stops instead of silently dropping releases', async () => {
    const r = await run(fixture('07-client-server').replace('on every 1 s', 'on every 1 ns'), 'Rpc::HealthCheck', { untilNs: 100, latencyNs: 10, maxPending: 1 });
    assert.equal(r.status, 'violation'); assert.ok(failed(r, 'ActivationOverflow'));
});
test('deadline counts request waiting and stops the selected system', async () => {
    const text = fixture('07-client-server').replace('on every 1 s {', 'on every 1 s timing { wcet 1 ns; deadline 5 ns; concurrency serial; } {');
    const r = await run(text, 'Rpc::HealthCheck', { untilNs: 1100000000, latencyNs: 10 });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1000000005);
});
test('reentrant root and local helper keep their dispatch snapshot across suspension', async () => {
    const text = `swaml "1.0"; package P {
      interface clientServer API version "1.0.0" { operation ping(): Void; }
      unit def Server { port api: API server; operation ping(): Void on call api.ping { return; } }
      unit def U { port api: API client; var current: Int = 0;
        operation helper(): Void { assert current == 0; }
        operation read(): Void on start timing { wcet 1 ns; deadline 100 ns; concurrency reentrant; } {
          let before: Int = current; request api.ping() as acknowledged within 50 ns otherwise { fail "unavailable"; };
          assert current == before; invoke helper();
        }
        operation write(): Void on start { set current = 2; }
      }
      component def C { unit u: U; unit serverUnit: Server; connect api: u.api -> serverUnit.api qos { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; }; }
      system S service { component c: C; }
    }`;
    const r = await run(text, 'P::S', { untilNs: 200, latencyNs: 5 });
    assert.equal(r.stores['c.u'].current, 2); assert.ok(!r.trace.some(t => t.kind === 'failure' || t.kind === 'violation'));
});
test('input deadline begins at readiness even while serial handler is blocked', async () => {
    const text = fixture('03-service-pubsub').replace('on receive orders.accepted {', 'on receive orders.accepted timing { wcet 1 ns; deadline 1 ns; concurrency serial; } {');
    const r = await run(text, 'Commerce::Shop', { untilNs: 100, manual: [{ atNs: 0, operation: 'web.frontend.checkout' }], faults: [{ offer: 4, kind: 'drop', delayNs: 10 }] });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1);
});
test('string escape decoding retains actual newline and tab values', async () => {
    const r = await run(program('set textValue = "a\\n\\tβ";', 'var textValue: String = "";'));
    assert.equal(r.stores['c.u'].textValue, 'a\n\tβ');
});
test('manual input and deterministic simulation produce repeatable traces', async () => {
    const text = fixture('08-service-field'), options = { untilNs: 100, manual: [{ atNs: 1, operation: 'front.panel.adjust' }] };
    const a = await run(text, 'Settings::Cabin', options), b = await run(text, 'Settings::Cabin', options);
    assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.stores, b.stores);
});
test('duplicate response is observed and discarded after first completion', async () => {
    const r = await run(fixture('07-client-server'), 'Rpc::HealthCheck', { untilNs: 1100000000, faults: [{ offer: 2, kind: 'duplicate' }] });
    assert.equal(r.trace.filter(t => t.kind === 'requestComplete').length, 1);
    assert.ok(r.trace.some(t => t.kind === 'discardResponse'));
});
test('helper deadline detects suspension before helper returns', async () => {
    const text = fixture('07-client-server').replace('operation poll(): Void on every 1 s {', 'operation poll(): Void on every 1 s { invoke helper(); } operation helper(): Void timing { wcet 1 ns; deadline 5 ns; concurrency serial; } {');
    const r = await run(text, 'Rpc::HealthCheck', { untilNs: 1100000000, latencyNs: 10 });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1000000005);
});
test('reject malformed numeric binding options instead of ignoring resource bounds', async () => {
    await assert.rejects(() => run(program('return;'), 'P::S', { untilNs: 1, maxSteps: 'unbounded' as unknown as number }), /maxSteps/);
});
test('machine data payload, exit/effect/entry order and finality execute directly', async () => {
    const text = `swaml "1.0"; package P {
      interface senderReceiver Signal version "1.0.0" { data step: Int queued; }
      unit def Sender { port output: Signal sender; operation run(): Void on start { send output.step(3); } }
      unit def Receiver { port input: Signal receiver; var count: Int = 0;
        operation run(): Void on start machine { initial A;
          state A { exit { set count = count + 1; } }
          state B final { entry { assert count == 4; } }
          transition next: A -> B on receive input.step when (payload > 0) { set count = count + payload; }
        }
      }
      component def C { unit senderUnit: Sender; unit receiverUnit: Receiver; connect signal: senderUnit.output -> receiverUnit.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; }; }
      system S service { component c: C; }
    }`;
    const r = await run(text); assert.equal(r.stores['c.receiverUnit'].count, 4); assert.equal(r.machines['c.receiverUnit.run'].live, false); assert.equal(r.outcome, 'no-failure-observed');
});
