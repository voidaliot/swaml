import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';
const fixture = (name: string) => readFileSync(new URL(`../../examples/${name}.swaml`, import.meta.url), 'utf8');
async function run(text: string, root: string = 'P::S', options: SimulationOptions = { untilNs: 1000000000 }) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const d = await parseHelper<Model>(Swaml)(text, { validation: true });
    assert.deepEqual(d.diagnostics, [], JSON.stringify(d.diagnostics));
    return simulate([d.parseResult.value], root, options);
}
const failed = (r: Awaited<ReturnType<typeof run>>, code: string) => r.trace.some(t => ['failure', 'violation'].includes(t.kind) && t.code === code);
const program = (body: string, vars = '') => `package P { component def U { ${vars} function run() on start { ${body} } } component def C { component u: U; } component S service { component c: C; } }`;

test('hello routes copied data through delegated boundaries', async () => {
    const r = await run(fixture('01-hello'), 'Hello::Demo');
    assert.ok(Object.values(r.stores).some(s => s.last === 'Hello, SWAML'));
    assert.equal(r.status, 'quiescent');
});
test('records, enums, arrays, calculations, branches, loops and local call execute', async () => {
    const r = await run(fixture('05-values-and-flow'), 'Values::Demo');
    assert.equal(r.stores['pipeline.consumer'].latest, 6);
    assert.equal(r.trace.filter(x => x.kind === 'delivery').length, 3);
});
test('periodic realtime model and effective allocation', async () => {
    const r = await run(fixture('02-realtime-controller'), 'Control::Heating', { untilNs: 30000000 });
    assert.equal(r.stores['controller.actuator'].applied, 0.235);
    assert.equal(r.deployments['controller.actuator'], 'system:ecu');
    assert.equal(r.trace.filter(x => x.kind === 'emission').length, 6);
    assert.equal(r.status, 'horizon');
});
test('service RPC completion unblocks serial callback and independent pubsub', async () => {
    const r = await run(fixture('03-service-pubsub'), 'Commerce::Shop', { untilNs: 3000000000, manual: [{ atNs: 0, function: 'web.frontend.checkout' }] });
    assert.equal(r.stores['web.frontend'].lastAccepted, 'order-42');
    assert.equal(r.stores['archive.store'].last, 'order-42');
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.state === 'Succeeded'));
    assert.ok(!r.trace.some(t => t.kind === 'failure'));
});
test('stateful function receives events and expires timer', async () => {
    const r = await run(fixture('04-stateful-function'), 'Lifecycle::Product', { untilNs: 31000000000, manual: [{ atNs: 1, function: 'assembly.operatorUnit.startDevice' }] });
    assert.deepEqual(r.machines['assembly.device.lifecycle'], { state: 'Stopped', live: false });
    assert.equal(r.stores['assembly.device'].cycles, 1);
    assert.equal(r.stores['assembly.monitor'].current, 'stopped');
});
test('whole-value assignment preserves scalar real widening and avoids integer overflow semantics', async () => {
    const r = await run(program('var x: real = 9007199254740991; x = x + 1; assert x > 9007199254740991;'));
    assert.ok(!failed(r, 'Arithmetic'));
});

for (const [name, body, code] of [
    ['int addition overflow', 'var x: int = 9007199254740991; x = x + 1;', 'Arithmetic'],
    ['int multiplication overflow', 'var x: int = 9007199254740991; x = x * 2;', 'Arithmetic'],
    ['division by zero', 'var x: real = 1 / 0;', 'Arithmetic'],
    ['negative remainder uses dividend sign', 'assert -5 % 2 == -1;', ''],
    ['computed bounds', 'var x: int[2] = [1, 2]; var i: int = 2; var y: int = x[i];', 'Bounds'],
    ['loop protection', 'while (true) bound 2 { assert true; }', 'LoopBound'],
    ['assertion', 'assert false;', 'Assertion'],
    ['short circuit avoids division', 'assert true or (1 / 0 == 0); assert not (false and (1 / 0 == 0));', ''],
    ['Unicode and escaped string equality', 'assert "a\\nβ" == "a\\nβ";', ''],
] as const) test(name, async () => {
    const r = await run(program(body));
    if (code) assert.ok(failed(r, code), JSON.stringify(r.trace)); else assert.ok(!r.trace.some(t => t.kind === 'failure'));
});
test('record equality ignores literal field order; record/array payloads are copied', async () => {
    const source = program('var a: T = record T { x = 1; y = 2; }; var b: T = record T { y = 2; x = 1; }; assert a == b; var c: T = a; a = record T { x = 3; y = 4; }; assert c.x == 1;').replace('component def U', 'datatype T { x: int; y: int; } component def U');
    assert.ok(!(await run(source)).trace.some(t => t.kind === 'failure'));
});
test('two occurrences never share mutable stores', async () => {
    const r = await run(fixture('08-service-field'), 'Settings::Cabin', { untilNs: 1000000000, manual: [{ atNs: 0, function: 'front.panel.adjust' }] });
    assert.equal(r.stores['settings.store'].currentValue, 22);
    assert.equal(r.stores['front.panel'].displayed, 22);
    assert.equal(r.stores['rear.panel'].displayed, 22);
});
test('timeout wins equal-time reply and late response has no second completion', async () => {
    const text = fixture('03-service-pubsub').replace('within 2 s', 'within 2 ns');
    const r = await run(text, 'Commerce::Shop', { untilNs: 10, latencyNs: 1, manual: [{ atNs: 0, function: 'web.frontend.checkout' }] });
    const completions = r.trace.filter(t => t.kind === 'requestComplete');
    assert.equal(completions.length, 1); assert.equal(completions[0].failure, 'Timeout');
    assert.ok(r.trace.some(t => t.kind === 'discardResponse'));
    assert.equal(r.stores['archive.store'].last, 'order-42');
});
test('response strictly before timeout succeeds', async () => {
    const r = await run(fixture('03-service-pubsub').replace('within 2 s', 'within 3 ns'), 'Commerce::Shop', { untilNs: 10, latencyNs: 1, manual: [{ atNs: 0, function: 'web.frontend.checkout' }] });
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.state === 'Succeeded'));
});
test('remote failures follow the originating correlation', async () => {
    const r = await run(fixture('03-service-pubsub').replace('return true;', 'fail "server rejected";'), 'Commerce::Shop', { untilNs: 3000000000, manual: [{ atNs: 0, function: 'web.frontend.checkout' }] });
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
test('manual harness cannot call a non-manual function', async () => {
    await assert.rejects(() => run(fixture('01-hello'), 'Hello::Demo', { untilNs: 0, manual: [{ atNs: 0, function: 'conversation.speaker.greet' }] }), /on manual/);
});
test('unbound optional RPC runs explicit Unavailable failure block', async () => {
    const source = `package P { interface clientServer API version "1.0.0" { function ping(); } component def U { port api: API client optional; var result: string = ""; function run() on start { call api.ping() as completionValue within 1 ns otherwise { result = failure; return; }; } } component def C { component u: U; } component S service { component c: C; } }`;
    assert.equal((await run(source)).stores['c.u'].result, 'Unavailable');
});
test('machine priority, payload effects and entry scopes', async () => {
    const text = fixture('04-stateful-function').replace('event begin();', 'event begin(value: int);').replace('commands.begin();', 'commands.begin(7);').replace('on receive commands.begin {}', 'on receive commands.begin when (value == 7) priority 2 { cycles = value; } transition other: Idle -> Stopped on receive commands.begin priority 1 {}');
    const r = await run(text, 'Lifecycle::Product', { untilNs: 10, manual: [{ atNs: 0, function: 'assembly.operatorUnit.startDevice' }] });
    assert.equal(r.stores['assembly.device'].cycles, 8); assert.equal(r.machines['assembly.device.lifecycle'].state, 'Running');
});
test('machine timer cancellation and post-final input are observable', async () => {
    const r = await run(fixture('04-stateful-function'), 'Lifecycle::Product', { untilNs: 31000000000, manual: [{ atNs: 1, function: 'assembly.operatorUnit.startDevice' }, { atNs: 2, function: 'assembly.operatorUnit.stopDevice' }, { atNs: 3, function: 'assembly.operatorUnit.startDevice' }] });
    assert.ok(r.trace.some(t => t.kind === 'discardTimer'));
    assert.ok(r.trace.some(t => t.kind === 'drop' && t.reason === 'Undeliverable'));
    assert.ok(!r.trace.some(t => t.kind === 'transition' && t.transition === 'expire'));
});
test('guarded completion cycle fails on the 1025th edge', async () => {
    const source = `package P { component def U { function run() on start { initial A; state A {} transition cycle: A -> A on completion when (true) {} } } component def C { component u: U; } component S service { component c: C; } }`;
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
    const text = fixture('05-values-and-flow').replace('component consumer: Consumer;', 'component consumer: Consumer; component other: Consumer; connect otherSamples: producer.output -> other.input qos { delivery atMostOnce; ordering fifo; capacity 3; overflow reject; };').replace('capacity 3; overflow reject; };\n    }', 'capacity 1; overflow reject; };\n    }');
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
    assert.equal(r.trace.filter(t => t.kind === 'dispatch' && t.function === 'serviceUnit.serverUnit.checkHealth').length, 2);
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
test('deadline counts request waiting and stops the selected root', async () => {
    const text = fixture('07-client-server').replace('on every 1 s {', 'on every 1 s timing { wcet 1 ns; deadline 5 ns; concurrency serial; } {');
    const r = await run(text, 'Rpc::HealthCheck', { untilNs: 1100000000, latencyNs: 10 });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1000000005);
});
test('reentrant root and local helper keep their dispatch snapshot across suspension', async () => {
    const text = `package P {
      interface clientServer API version "1.0.0" { function ping(); }
      component def Server { port api: API server; function ping() on call api.ping { return; } }
      component def U { port api: API client; var current: int = 0;
        function helper() { assert current == 0; }
        function read() on start timing { wcet 1 ns; deadline 100 ns; concurrency reentrant; } {
          var before: int = current; call api.ping() as acknowledged within 50 ns otherwise { fail "unavailable"; };
          assert current == before; call helper();
        }
        function write() on start { current = 2; }
      }
      component def C { component u: U; component serverUnit: Server; connect api: u.api -> serverUnit.api qos { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; }; }
      component S service { component c: C; }
    }`;
    const r = await run(text, 'P::S', { untilNs: 200, latencyNs: 5 });
    assert.equal(r.stores['c.u'].current, 2); assert.ok(!r.trace.some(t => t.kind === 'failure' || t.kind === 'violation'));
});
test('input deadline begins at readiness even while serial handler is blocked', async () => {
    const text = fixture('03-service-pubsub').replace('on receive orders.accepted {', 'on receive orders.accepted timing { wcet 1 ns; deadline 1 ns; concurrency serial; } {');
    const r = await run(text, 'Commerce::Shop', { untilNs: 100, manual: [{ atNs: 0, function: 'web.frontend.checkout' }], faults: [{ offer: 4, kind: 'drop', delayNs: 10 }] });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1);
});
test('string escape decoding retains actual newline and tab values', async () => {
    const r = await run(program('textValue = "a\\n\\tβ";', 'var textValue: string = "";'));
    assert.equal(r.stores['c.u'].textValue, 'a\n\tβ');
});
test('manual input and deterministic simulation produce repeatable traces', async () => {
    const text = fixture('08-service-field'), options = { untilNs: 100, manual: [{ atNs: 1, function: 'front.panel.adjust' }] };
    const a = await run(text, 'Settings::Cabin', options), b = await run(text, 'Settings::Cabin', options);
    assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.stores, b.stores);
});
test('duplicate response is observed and discarded after first completion', async () => {
    const r = await run(fixture('07-client-server'), 'Rpc::HealthCheck', { untilNs: 1100000000, faults: [{ offer: 2, kind: 'duplicate' }] });
    assert.equal(r.trace.filter(t => t.kind === 'requestComplete').length, 1);
    assert.ok(r.trace.some(t => t.kind === 'discardResponse'));
});
test('helper deadline detects suspension before helper returns', async () => {
    const text = fixture('07-client-server').replace(/function poll\(\)(?:: void)? on every 1 s \{/, 'function poll() on every 1 s { call helper(); } function helper() timing { wcet 1 ns; deadline 5 ns; concurrency serial; } {');
    const r = await run(text, 'Rpc::HealthCheck', { untilNs: 1100000000, latencyNs: 10 });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 1000000005);
});
test('reject malformed numeric binding options instead of ignoring resource bounds', async () => {
    await assert.rejects(() => run(program('return;'), 'P::S', { untilNs: 1, maxSteps: 'unbounded' as unknown as number }), /maxSteps/);
});
test('machine data payload, exit/effect/entry order and finality execute directly', async () => {
    const text = `package P {
      interface senderReceiver Signal version "1.0.0" { data step: int queued; }
      component def Sender { port output: Signal sender; function run() on start { send output.step(3); } }
      component def Receiver { port input: Signal receiver; var count: int = 0;
        function run() on start { initial A;
          state A { exit { count = count + 1; } }
          state B final { entry { assert count == 4; } }
          transition next: A -> B on receive input.step when (payload > 0) { count = count + payload; }
        }
      }
      component def C { component senderUnit: Sender; component receiverUnit: Receiver; connect signal: senderUnit.output -> receiverUnit.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; }; }
      component S service { component c: C; }
    }`;
    const r = await run(text); assert.equal(r.stores['c.receiverUnit'].count, 4); assert.equal(r.machines['c.receiverUnit.run'].live, false); assert.equal(r.outcome, 'no-failure-observed');
});

const queuedMachine = (termination: string, stopAt = 3, deadline = 5) => `package P {
          interface publishSubscribe I version "1.0.0" { event e(); }
          component def Sender { port p: I publisher;
            function run() on start { publish p.e(); publish p.e(); }
          }
          component def Receiver { port p: I subscriber;
            function run() on start timing { wcet 1 ns; deadline ${deadline} ns; concurrency serial; } {
              initial A; state A {} state B ${termination === 'final' ? 'final' : ''} {}
              transition stop: A -> B on after ${stopAt} ns { ${termination === 'return' ? 'return;' : termination === 'fail' ? 'fail "stopped";' : ''} }
              transition consume: A -> A on receive p.e {}
            }
          }
          component def C { component senderUnit: Sender; component receiverUnit: Receiver;
            connect events: senderUnit.p -> receiverUnit.p qos { delivery atLeastOnce; ordering fifo; capacity 2; overflow reject; };
          }
          component S service { component c: C; }
        }`;
for (const termination of ['final', 'return', 'fail']) for (const readyAt of [2, 4]) {
    test(`terminated machine discards FIFO-blocked inputs: ${termination}, ready at ${readyAt}`, async () => {
        const r = await run(queuedMachine(termination), 'P::S', { untilNs: 50, latencyNs: readyAt, faults: [{ offer: 1, kind: 'drop', delayNs: 20 }] });
        // An atLeastOnce retry keeps the first offer in flight until 40 ns, blocking the ready second input.
        assert.equal(r.machines['c.receiverUnit.run'].live, false);
        assert.ok(!failed(r, 'Deadline'), JSON.stringify(r.trace));
        assert.deepEqual(r.trace.filter(t => t.kind === 'drop' && t.reason === 'Undeliverable').map(t => t.timeNs), [Math.max(3, readyAt), 40]);
        assert.equal(r.trace.filter(t => t.kind === 'release' && t.function === 'c.receiverUnit.run').length, readyAt < 3 ? 3 : 2);
        assert.equal(r.trace.filter(t => t.kind === 'delivery').length, 0);
        assert.equal(r.status, 'quiescent');
    });
}
test('a live machine retains the deadline of a FIFO-blocked ready input', async () => {
    const r = await run(queuedMachine('final', 60), 'P::S', { untilNs: 50, latencyNs: 2, faults: [{ offer: 1, kind: 'drop', delayNs: 20 }] });
    assert.ok(failed(r, 'Deadline')); assert.equal(r.timeNs, 7);
    assert.equal(r.machines['c.receiverUnit.run'].live, true);
});
test('live machine input delivery preserves FIFO when later input becomes ready first', async () => {
    const r = await run(queuedMachine('final', 60, 100), 'P::S', { untilNs: 50, latencyNs: 2, faults: [{ offer: 1, kind: 'drop', delayNs: 20 }] });
    const sent = r.trace.filter(t => t.kind === 'emission').map(t => t.subject);
    assert.deepEqual(r.trace.filter(t => t.kind === 'delivery').map(t => [t.subject, t.timeNs]), sent.map(id => [id, 40]));
    assert.equal(r.outcome, 'no-failure-observed');
});

test('inline roots directly contain child components and preserve typed interface routing', async () => {
    const source = `package P {
        interface senderReceiver Numbers version "1.0.0" { data value: int queued; }
        component def Sender { port output: Numbers sender; function run() on start { send output.value(42); } }
        component def Receiver { port input: Numbers receiver; var current: int = 0; function take(value: int) on receive input.value { current = value; } }
        component S {
            component senderUnit: Sender; component receiverUnit: Receiver;
            connect values: senderUnit.output -> receiverUnit.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
        }
    }`;
    const r = await run(source);
    assert.equal(r.profile, 'swaml-reference/1.3'); assert.equal(r.root, 'P::S');
    assert.deepEqual(Object.keys(r.stores), ['', 'senderUnit', 'receiverUnit']);
    assert.equal(r.stores.receiverUnit.current, 42);
    assert.equal(r.trace.filter(t => t.kind === 'delivery').length, 1);
});

test('typed roots expand definitions with independent stores on each selected run', async () => {
    const source = `package P {
        component def Counter { var count: int = 0; function increment() on manual { count = count + 1; } }
        component def Assembly { component left: Counter; component right: Counter; }
        component first: Assembly;
        component second: Assembly service;
    }`;
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(source, { validation: true });
    assert.deepEqual(doc.diagnostics, []);
    const models = [doc.parseResult.value];
    const first = simulate(models, 'P::first', { untilNs: 1, manual: [{ atNs: 0, function: 'left.increment' }] });
    const second = simulate(models, 'P::second', { untilNs: 1 });
    assert.equal(first.stores.left.count, 1); assert.equal(first.stores.right.count, 0);
    assert.equal(second.stores.left.count, 0); assert.equal(second.stores.right.count, 0);
    assert.equal(first.root, 'P::first'); assert.equal(second.root, 'P::second');
    assert.equal(simulate(models, 'P::first', { untilNs: 1 }).stores.left.count, 0);
    assert.throws(() => simulate(models, 'P::Assembly', { untilNs: 1 }), /Unknown root/);
});

test('typed root expands definition connections through component delegation', async () => {
    const source = `package P {
        interface senderReceiver Numbers version "1.0.0" { data value: int queued; }
        component def Sender { port output: Numbers sender; function run() on start { send output.value(42); } }
        component def Receiver { port input: Numbers receiver; var current: int = 0; function take(value: int) on receive input.value { current = value; } }
        component def Producer { port outgoing: Numbers sender; component speaker: Sender; delegate outgoing -> speaker.output; }
        component def Consumer { port incoming: Numbers receiver; component listener: Receiver; delegate incoming -> listener.input; }
        component def Assembly {
            component producer: Producer; component consumer: Consumer;
            connect values: producer.outgoing -> consumer.incoming qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
        }
        component S: Assembly;
    }`;
    const r = await run(source);
    assert.equal(r.stores['consumer.listener'].current, 42);
    assert.equal(r.trace.filter(t => t.kind === 'delivery').length, 1);
    assert.equal(r.outcome, 'no-failure-observed');
});

test('typed root bindings inherit deployment and use the nearest explicit descendant override', async () => {
    const source = `package P {
        component def Worker { function run() on start timing { wcet 1 ns; deadline 2 ns; concurrency serial; } { return; } }
        component def Pair { component left: Worker; component right: Worker; }
        component def Assembly { component pair: Pair; }
        component S: Assembly realtime { deploy pair on "system:first"; deploy pair.right on "system:second"; }
    }`;
    const r = await run(source);
    assert.deepEqual({ ...r.deployments }, { '': null, pair: 'system:first', 'pair.left': 'system:first', 'pair.right': 'system:second' });
    assert.equal(r.outcome, 'no-failure-observed');
});

test('short expression forms distinguish lexical fields from qualified nominal enum literals', async () => {
    const source = `package P {
        enum Status { Ready, Done }
        datatype Holder { Ready: int; }
        component def U {
            var status: Status = Status.Ready;
            var count: int = 0;
        function run() on start {
            calc next { in x: int; return result: int = x + 1; }
            calc ready { return result: Status = Status.Ready; }

                var Status: Holder = record Holder { Ready = 7; };
                var values: int[2] = [Status.Ready, next(7)];
                count = values[1];
                assert Status.Ready == 7;
                assert status == P::Status.Ready;
                assert ready() == P::Status.Ready;
            }
        }
        component S { component u: U; }
    }`;
    const r = await run(source);
    assert.equal(r.stores.u.count, 8); assert.equal(r.stores.u.status, 'Ready');
    assert.equal(r.outcome, 'no-failure-observed');
});

test('imported typed root definitions, enums and function literals execute across documents', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem), parse = parseHelper<Model>(Swaml);
    const library = await parse(`package Library {
        enum Status { Ready }
        component def Worker {
            var status: Status = Status.Ready;
        function run() on start {
            calc ready { return result: Status = Status.Ready; }
            assert status == ready(); }
        }
        component def Assembly { component worker: Worker; }
    }`, { documentUri: 'file:///library.swaml' });
    const application = await parse('package Application { import Library::*; component S: Assembly; }', { documentUri: 'file:///application.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    for (const doc of [library, application]) assert.deepEqual(doc.diagnostics, []);
    const models = [library.parseResult.value, application.parseResult.value];
    const r = simulate(models, 'Application::S', { untilNs: 1 });
    assert.equal(r.stores.worker.status, 'Ready'); assert.equal(r.outcome, 'no-failure-observed');
    assert.equal(r.sources.length, 2);
    assert.throws(() => simulate([application.parseResult.value], 'Application::S', { untilNs: 1 }), /every referenced document/);
});

for (const qualified of [true, false]) test(`enum-only document dependencies must be included: ${qualified ? 'qualified value' : 'imported value'}`, async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem), parse = parseHelper<Model>(Swaml);
    const library = await parse('package Library { enum Status { Ready } }', { documentUri: 'file:///enum.swaml' });
    const literal = qualified ? 'Library::Status.Ready' : 'Status.Ready';
    const application = await parse(`package Application {
        ${qualified ? '' : 'import Library::*;'}
        component def U { function run() on start { assert ${literal} == ${literal}; } }
        component S { component u: U; }
    }`, { documentUri: 'file:///enum-user.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    for (const doc of [library, application]) assert.deepEqual(doc.diagnostics, []);
    const result = simulate([library.parseResult.value, application.parseResult.value], 'Application::S', { untilNs: 1 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.throws(() => simulate([application.parseResult.value], 'Application::S', { untilNs: 1 }), /every referenced document/);
});
