import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';

async function run(text: string, options: SimulationOptions = { untilNs: 100 }) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(text, { validation: true });
    assert.deepEqual(document.diagnostics, [], JSON.stringify(document.diagnostics));
    return simulate([document.parseResult.value], 'P::System', options);
}

test('every component instance owns independent data, helpers and inherited dispatch', async () => {
    const result = await run(`package P {
        component def Base {
            var count: int = 0;
        function helper() {
            calc amount { in value: int; return result: int = value + 1; }
            count = amount(count); }
            function boot() on start { call helper(); }
            function increment() on manual { call helper(); }
        }
        component def Specialized specializes Base {
            redefines function helper() { calc amount { in value: int; return result: int = value + 5; } count = amount(count) * 2; }
        }
        component System { component first: Specialized; component second: Specialized; component base: Base; }
    }`, { untilNs: 100, manual: [{ atNs: 1, function: 'first.increment' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.first.count, 30);
    assert.equal(result.stores.second.count, 10);
    assert.equal(result.stores.base.count, 1);
    assert.ok(result.trace.some(event => event.kind === 'dispatch' && event.function === 'first.boot'));
});

test('components and roots execute local behavior while composing child components', async () => {
    const result = await run(`package P {
        interface senderReceiver Signal version "1.0.0" { data value: int queued; }
        component def Receiver {
            port input: Signal receiver;
            var observed: int = 0;
            function observe(value: int) on receive input.value { observed = value; }
        }
        component def Parent {
            component child: Receiver;
            port output: Signal sender;
            var sent: int = 0;
            function boot() on start { sent = 7; send output.value(sent); }
            connect local: output -> child.input qos { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; };
        }
        component System {
            var started: bool = false;
            function boot() on start { started = true; }
            function reset() on manual { started = false; }
            component parent: Parent;
            deploy System on "sysml:Vehicle::computer";
        }
    }`, { untilNs: 10, manual: [{ atNs: 1, function: 'reset' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores[''].started, false);
    assert.equal(result.stores.parent.sent, 7);
    assert.equal(result.stores['parent.child'].observed, 7);
    assert.equal(result.deployments['parent.child'], 'sysml:Vehicle::computer');
    assert.ok(result.trace.some(event => event.kind === 'dispatch' && event.function === 'boot'));
});

test('typed root behavior uses specialization and its own state store', async () => {
    const result = await run(`package P {
        component def Base { var total: int = 1; function boot() on start { call add(); } function add() { total = total + 1; } }
        component def Derived specializes Base { redefines var total: int = 10; redefines function add() { total = total + 2; } }
        component System: Derived;
    }`);
    assert.equal(result.stores[''].total, 12);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('calculation inputs and output preserve unsigned and byte domains', async () => {
    const result = await run(`package P { component System {
        var count: uint = 0;
        var encoded: byte = 0;
        function boot() on start {
            calc encode { in amount: uint; in offset: byte; return octet: byte = amount + offset; }
            count = 250; encoded = encode(count, 5); assert encoded == 255; assert -encoded == -255; }
    } }`);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores[''], { count: 250, encoded: 255 });
});

for (const [name, declarations, body] of [
    ['byte assignment', 'var value: byte = 0;', 'var next: int = 256; value = next;'],
    ['unsigned assignment', 'var value: uint = 0;', 'var next: int = -1; value = next;'],
    ['calculation input', 'calc identity { in value: byte; return result: byte = value; }', 'var next: int = 256; var result: byte = identity(next);'],
    ['calculation output', 'calc increment { in value: byte; return result: byte = value + 1; }', 'var result: byte = increment(255);'],
    ['local function input', 'function accept(value: byte) { assert true; }', 'var next: int = 256; call accept(next);'],
] as const) test(`runtime checks ${name} bounds before copying`, async () => {
    const result = await run(`package P { component System { ${declarations.startsWith("calc ") ? "" : declarations} function boot() on start { ${declarations.startsWith("calc ") ? declarations : ""} ${body} } } }`);
    assert.equal(result.outcome, 'failed');
    assert.ok(result.trace.some(event => event.kind === 'failure' && event.code === 'Bounds'), JSON.stringify(result.trace));
});

test('manual harness rejects retired operation key instead of guessing a function', async () => {
    await assert.rejects(() => run('package P { component System { function boot() on manual {} } }', { untilNs: 1, manual: [{ atNs: 0, operation: 'boot' }] } as unknown as SimulationOptions), /function path/);
});

test('numeric literal arrays and nominal record fields retain constrained element types', async () => {
    const result = await run(`package P {
        datatype Packet { bytes: byte[2]; length: uint; }
        component System {
            var packet: Packet = record Packet { bytes = [0, 255]; length = 2; };
            function boot() on start {
                var copied: Packet = packet;
                packet = record Packet { bytes = [1, 2]; length = 2; };
                assert copied.bytes[1] == 255;
                assert packet.bytes[1] == 2;
            }
        }
    }`);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores[''].packet, { bytes: [1, 2], length: 2 });
});

test('out-of-range payloads fail at the emitting function without creating a message', async () => {
    const result = await run(`package P {
        interface senderReceiver Octet version "1.0.0" { data value: byte queued; }
        component def Receiver { port input: Octet receiver; var last: byte = 0; function observe(value: byte) on receive input.value { last = value; } }
        component System {
            port output: Octet sender;
            component consumer: Receiver;
            function boot() on start { var oversized: int = 256; send output.value(oversized); }
            connect wire: output -> consumer.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
        }
    }`);
    assert.equal(result.outcome, 'failed');
    assert.ok(result.trace.some(event => event.kind === 'failure' && event.function === 'boot' && event.code === 'Bounds'));
    assert.ok(!result.trace.some(event => event.kind === 'emission'));
    assert.equal(result.stores.consumer.last, 0);
});

test('a failing inherited calculation preserves earlier local effects and isolates sibling stores', async () => {
    const result = await run(`package P {
        component def Base {
            var count: uint = 0;
            var sample: byte = 0;
        function step() {
            calc encode { in value: uint; return result: byte = value; }
            count = count + 1; sample = encode(count); }
            function boot() on start { call step(); }
            function advance() on manual { call step(); }
        }
        component def Derived specializes Base {
            redefines function step() { calc encode { in value: uint; return result: byte = value * 200; } count = count + 1; sample = encode(count); }
        }
        component System { component left: Derived; component right: Derived; }
    }`, { untilNs: 10, manual: [{ atNs: 1, function: 'left.advance' }] });
    assert.equal(result.outcome, 'failed');
    assert.deepEqual(result.stores.left, { count: 2, sample: 200 });
    assert.deepEqual(result.stores.right, { count: 1, sample: 200 });
    assert.ok(result.trace.some(event => event.kind === 'failure' && event.function === 'left.advance' && event.code === 'Bounds'));
});

test('specialized service handlers preserve correlations and reject invalid function results', async () => {
    const result = await run(`package P {
        interface clientServer Convert version "1.0.0" { function convert(value: byte): byte; }
        component def Server {
            port api: Convert server;
            var handled: uint = 0;
            function convert(value: byte): byte on call api.convert { handled = handled + 1; return value; }
        }
        component def Incrementer specializes Server {
            redefines function convert(value: byte): byte on call api.convert { handled = handled + 1; return value + 1; }
        }
        component System {
            port api: Convert client;
            component backend: Incrementer;
            var sample: byte = 0;
            var rejected: bool = false;
            function boot() on start {
                call api.convert(254) as converted within 1 s otherwise { fail "unexpected conversion failure"; };
                sample = converted;
            }
            function tryOverflow() on manual {
                call api.convert(255) as converted within 1 s otherwise { rejected = failure == "RemoteFailure"; return; };
                fail "out-of-range result was accepted";
            }
            connect rpc: api -> backend.api qos { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; };
        }
    }`, { untilNs: 10, manual: [{ atNs: 1, function: 'tryOverflow' }] });
    assert.equal(result.stores[''].sample, 255);
    assert.equal(result.stores[''].rejected, true);
    assert.equal(result.stores.backend.handled, 2);
    assert.ok(result.trace.some(event => event.kind === 'failure' && event.function === 'backend.convert' && event.code === 'Bounds'));
    const completions = result.trace.filter(event => event.kind === 'requestComplete');
    assert.equal(completions.length, 2);
    assert.equal(completions[0].state, 'Succeeded');
    assert.equal(completions[1].failure, 'RemoteFailure');
});

test('an explicit self-route queues a typed callback until the serial sender completes', async () => {
    const result = await run(`package P {
        interface publishSubscribe Notifications version "1.0.0" { event changed(value: uint); }
        component System {
            port output: Notifications publisher;
            port input: Notifications subscriber;
            var phase: uint = 0;
            var received: uint = 0;
            function boot() on start {
                phase = 1;
                publish output.changed(7);
                phase = 2;
            }
            function observe(value: uint) on receive input.changed {
                assert phase == 2;
                received = value;
            }
            connect callback: output -> input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
        }
    }`);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores[''], { phase: 2, received: 7 });
    const emission = result.trace.find(event => event.kind === 'emission');
    assert.equal(emission?.route, 'callback');
    assert.equal(emission?.source, 'output.changed');
    assert.equal(emission?.target, 'input.changed');
    assert.ok(result.trace.some(event => event.kind === 'admission' && event.queue === 'callback/forward/changed'));
    const complete = result.trace.findIndex(event => event.kind === 'complete' && event.function === 'boot');
    const dispatch = result.trace.findIndex(event => event.kind === 'dispatch' && event.function === 'observe');
    assert.ok(complete >= 0 && dispatch > complete, JSON.stringify(result.trace));
});
