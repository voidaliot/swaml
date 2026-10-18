import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import type { Model } from '../src/language/generated/ast.js';
import { createSwamlServices } from '../src/language/swaml-module.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';

const example = readFileSync(new URL('../../examples/19-interruptible-function.swaml', import.meta.url), 'utf8');
const options: SimulationOptions = { untilNs: 60000000, latencyNs: 5000000, manual: [{ atNs: 2000000, function: 'controller.stop' }] };
async function parse(source: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(source, { validation: true });
    assert.ok(!doc.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(doc.diagnostics));
    return doc;
}
async function run(source = example, config = options) {
    const doc = await parse(source);
    assert.deepEqual(doc.diagnostics, []);
    return simulate([doc.parseResult.value], 'Interrupts::App', config);
}
const body = (source: string, replacement: string) => source.replace(/function run\(\) on start \{[\s\S]*?\n        \}\n    \}\n    component def Service/, `function run() on start { ${replacement} }\n    }\n    component def Service`);
const request = 'call job.perform() as value within 50 ms otherwise { fail "request failure branch"; };';

test('interrupt cancels a suspended region, retains server effects and discards its late reply', async () => {
    const result = await run();
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores.worker, { status: 2, why: 'operator stop' });
    assert.deepEqual(result.stores.backend, { committed: 1 });
    assert.equal(result.trace.filter(event => event.kind === 'interrupt').length, 1);
    assert.equal(result.trace.find(event => event.kind === 'interrupt')?.timeNs, 7000000);
    const cancelled = result.trace.find(event => event.kind === 'requestCancelled')!;
    assert.equal(cancelled.reason, 'Interrupted');
    assert.ok(result.trace.some(event => event.kind === 'discardResponse' && event.subject === cancelled.subject));
    assert.ok(!result.trace.some(event => event.kind === 'timeout' || event.kind === 'failure'));
    assert.equal(result.trace.filter(event => event.kind === 'release' && event.function === 'worker.run').length, 1);
});

test('normal completion disarms the region and a later interrupt cannot activate the function', async () => {
    const result = await run(example.replace('assert status == 2;', 'assert status == 10;'), { ...options, manual: [{ atNs: 20000000, function: 'controller.stop' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.worker.status, 10);
    assert.equal(result.stores.worker.why, '');
    assert.ok(result.trace.some(event => event.kind === 'drop' && event.reason === 'UndeliverableInterrupt'));
    assert.ok(!result.trace.some(event => event.kind === 'interrupt'));
});

test('an interrupt arriving before region entry is discarded instead of retained for later entry', async () => {
    const source = body(example, `${request.replace('as value', 'as priorValue')} interruptible work { ${request} status = value; } on receive control.stop { status = 2; } assert status == 10;`);
    const result = await run(source);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.worker.status, 10);
    assert.ok(result.trace.some(event => event.kind === 'drop' && event.reason === 'UndeliverableInterrupt' && event.timeNs === 7000000));
    assert.ok(!result.trace.some(event => event.kind === 'interrupt'));
});

test('interrupt unwinds a local helper and skips the cancelled request otherwise branch', async () => {
    let source = body(example, 'interruptible work { status = 1; call helper(); status = 10; } on receive control.stop { status = 2; } assert status == 2;');
    source = source.replace('function run() on start', `function helper() timing { wcet 1 ms; deadline 20 ms; concurrency serial; } { ${request} status = value; } function run() on start`);
    const result = await run(source);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.worker.status, 2);
    assert.equal(result.trace.filter(event => event.kind === 'requestCancelled').length, 1);
});

test('same-time input can interrupt a counted loop at a statement boundary', async () => {
    const source = body(example, 'interruptible work { status = 1; for (var i: int = 0; i < 100; i = i + 1) bound 100 { status = status + 1; } } on receive control.stop { status = status + 20; } assert status == 21;');
    const result = await run(source, { untilNs: 1, manual: [{ atNs: 0, function: 'controller.stop' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.worker.status, 21);
    assert.equal(result.trace.find(event => event.kind === 'interrupt')?.timeNs, 0);
});

test('nested outer interruption unwinds the inner region without executing its handler', async () => {
    let source = example.replace('event stop(reason: string);', 'event stop(reason: string); event stopAll(cause: string);');
    source = source.replace('function stop() on manual', 'function unused() on manual { publish control.stop("unused"); } function stop() on manual').replace('publish control.stop("operator stop")', 'publish control.stopAll("all work")');
    source = body(source, `interruptible outer { interruptible inner { ${request} status = 10; } on receive control.stop { status = 2; } } on receive control.stopAll { status = 3; why = cause; } assert status == 3;`);
    const result = await run(source);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores.worker, { status: 3, why: 'all work' });
    assert.ok(result.trace.some(event => event.kind === 'regionExit' && event.region === 'inner' && event.outcome === 'unwound'));
    assert.ok(result.trace.some(event => event.kind === 'regionExit' && event.region === 'outer' && event.outcome === 'interrupted'));
});

test('outer interruption cancels a nested handler RPC and completes at the activation deadline', async () => {
    let source = example.replace('event stop(reason: string);', 'event stop(reason: string); event stopAll(cause: string);');
    source = source.replace('function stop() on manual { publish control.stop("operator stop"); }', 'function stop() on manual { publish control.stop("inner"); } function stopAll() on manual { publish control.stopAll("outer"); }');
    source = body(source, `interruptible outer { interruptible inner { ${request} status = 10; } on receive control.stop { call job.perform() as again within 50 ms otherwise { fail "nested request failed"; }; status = again; } } on receive control.stopAll { status = 3; why = cause; } assert status == 3;`);
    source = source.replace('function run() on start', 'function run() on start timing { wcet 1 ms; deadline 10 ms; concurrency serial; }');
    const result = await run(source, { ...options, manual: [{ atNs: 2000000, function: 'controller.stop' }, { atNs: 5000000, function: 'controller.stopAll' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores.worker, { status: 3, why: 'outer' });
    assert.equal(result.stores.backend.committed, 2);
    const cancelled = result.trace.filter(event => event.kind === 'requestCancelled');
    assert.equal(cancelled.length, 2);
    assert.deepEqual(cancelled.map(event => [event.region, event.timeNs]), [['inner', 7000000], ['outer', 10000000]]);
    for (const request of cancelled) assert.ok(result.trace.some(event => event.kind === 'discardResponse' && event.subject === request.subject));
    assert.equal(result.trace.filter(event => event.kind === 'release' && event.function === 'worker.run').length, 1);
    assert.ok(result.trace.some(event => event.kind === 'complete' && event.function === 'worker.run' && event.timeNs === 10000000));
    assert.ok(!result.trace.some(event => ['failure', 'violation', 'timeout'].includes(event.kind)));
});

test('timeout remains the terminal correlation outcome when an interrupt arrives at expiry', async () => {
    const source = example.replace('within 50 ms', 'within 10 ms');
    const result = await run(source, { ...options, manual: [{ atNs: 5000000, function: 'controller.stop' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.ok(result.trace.some(event => event.kind === 'requestComplete' && event.failure === 'Timeout' && event.timeNs === 10000000));
    assert.ok(!result.trace.some(event => event.kind === 'requestCancelled'));
    assert.equal(result.stores.worker.status, 2);
});

test('duplicate interrupt delivery does not run the one-shot handler twice', async () => {
    const source = example.replace(/(connect stopRoute:[\s\S]*?delivery )atMostOnce/, '$1atLeastOnce');
    const result = await run(source, { ...options, faults: [{ offer: 2, kind: 'duplicate' }] });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.trace.filter(event => event.kind === 'interrupt').length, 1);
    assert.ok(result.trace.some(event => event.kind === 'drop' && event.reason === 'UndeliverableInterrupt'));
});

test('data interrupts bind a copied typed payload only in the handler', async () => {
    let source = example.replace('interface publishSubscribe Control', 'interface senderReceiver Control').replace('event stop(reason: string);', 'data stop: int queued;').replace('Control subscriber', 'Control receiver').replace('Control publisher', 'Control sender').replace('publish control.stop("operator stop")', 'send control.stop(7)').replace('why = reason;', 'status = payload;').replace('assert status == 2;', 'assert status == 7;');
    source = source.replace('publish controller.control.stop', 'send controller.control.stop');
    const result = await run(source);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores.worker.status, 7);
});

test('return and failure exit protected regions without entering their interrupt handler', async () => {
    for (const terminal of ['return;', 'fail "expected";']) {
        const result = await run(body(example, `interruptible work { status = 1; ${terminal} } on receive control.stop { status = 2; }`));
        assert.equal(result.stores.worker.status, 1);
        assert.ok(!result.trace.some(event => event.kind === 'interrupt'));
        assert.ok(result.trace.some(event => event.kind === 'regionExit' && event.outcome === 'unwound'));
    }
});

for (const [name, transform, code] of [
    ['untriggered function', (s: string) => s.replace('function run() on start', 'function run()'), 'SW065'],
    ['reentrant function', (s: string) => s.replace('function run() on start', 'function run() on start timing { wcet 1 ms; deadline 20 ms; concurrency reentrant; }'), 'SW065'],
    ['nonlocal endpoint', (s: string) => s.replace('on receive control.stop', 'on receive controller.control.stop'), 'SW051'],
    ['RPC interrupt', (s: string) => s.replace('on receive control.stop', 'on receive job.perform'), 'SW051'],
    ['output endpoint', (s: string) => s.replace('Control subscriber', 'Control publisher'), 'SW051'],
    ['handler payload scope', (s: string) => s.replace('assert status == 2;', 'assert reason == "operator stop";'), 'SW022'],
    ['payload shadowing', (s: string) => s.replace('function run() on start {', 'function run() on start { var reason: string = "shadow";'), 'SW002'],
    ['protected local scope', (s: string) => s.replace('status = 1;', 'var local: int = 1; status = local;').replace('status = 2;', 'status = local;'), 'SW022'],
    ['duplicate region name', (s: string) => s.replace('assert status == 2;', 'interruptible work {} on receive control.stop {}'), 'SW002'],
    ['duplicate interrupt member', (s: string) => s.replace('assert status == 2;', 'interruptible second {} on receive control.stop {}'), 'SW065'],
    ['second receiving owner', (s: string) => s.replace('function run() on start', 'function duplicate(reason: string) on receive control.stop {} function run() on start'), 'SW055'],
] as const) test(`reject interrupt ${name}`, async () => {
    const doc = await parse(transform(example));
    assert.ok(doc.diagnostics?.some(d => d.code === code), JSON.stringify(doc.diagnostics));
});

test('state entry cannot introduce an interruptible region with a second stimulus owner', async () => {
    const source = body(example, 'initial Idle; state Idle { entry { interruptible work {} on receive control.stop {} } }');
    const doc = await parse(source);
    assert.ok(doc.diagnostics?.some(d => d.code === 'SW065'));
});

test('a delegated port cannot retain an interrupt handler inherited from another document', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem), read = parseHelper<Model>(Swaml);
    const library = await read(`package Library {
        interface publishSubscribe Control version "1.0.0" { event stop(reason: string); }
        component def Base {
            port control: Control subscriber optional;
            function run() on start { interruptible work {} on receive control.stop {} }
        }
        component def Sink {
            port control: Control subscriber optional;
            function stop(reason: string) on receive control.stop {}
        }
    }`, { documentUri: 'file:///interrupt-base.swaml' });
    const application = await read(`package Application {
        component def Composite specializes Library::Base {
            component child: Library::Sink;
            delegate control -> child.control;
        }
    }`, { documentUri: 'file:///interrupt-delegation.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    assert.deepEqual(library.diagnostics, []);
    assert.ok(application.diagnostics?.some(d => d.code === 'SW033'), JSON.stringify(application.diagnostics));
    assert.ok(!application.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))));
});

for (const fragment of ['interruptible work {}', 'interruptible work {} on receive {}', 'interruptible work {} on call control.stop {}', 'interruptible work { on receive control.stop {}']) test(`malformed region recovers without validator crash: ${fragment}`, async () => {
    const doc = await parse(body(example, fragment));
    assert.ok(doc.parseResult.parserErrors.length > 0);
    assert.ok(doc.diagnostics?.some(d => d.severity === 1));
});
