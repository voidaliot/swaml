import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import { isFunctionDef, isRootComponent, type Model } from '../src/language/generated/ast.js';

async function diagnostics(text: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const doc = await parse(text, { validation: true });
    return doc.diagnostics ?? [];
}
const load = (name: string) => readFileSync(new URL(`../../examples/${name}`, import.meta.url), 'utf8');
const hello = load('01-hello.swaml');
for (const file of readdirSync(new URL('../../examples/', import.meta.url)).filter(f => f.endsWith('.swaml'))) {
    test(`valid example ${file}`, async () => assert.deepEqual(await diagnostics(load(file)), []));
}
const failures: [string, string, string | undefined][] = [
    ['cross-component member access', hello.replace('send output.text(', 'send listener.input.text('), 'SW050'],
    ['wrong communication verb', hello.replace('send output.text(', 'publish output.text('), 'SW051'],
    ['sender used as receiver', hello.replace('Greeting receiver', 'Greeting sender'), 'SW032'],
    ['payload type mismatch', hello.replace('"Hello, SWAML"', '42'), 'SW023'],
    ['handler mismatch', hello.replace('message: string', 'message: int'), 'SW052'],
    ['missing handler', hello.replace('on receive input.text', 'on start').replace('hear(message: string)', 'hear()').replace('last = message;', ''), 'SW055'],
    ['unconnected port', hello.replace(/connect greeting:[\s\S]*?};/, ''), 'SW034'],
    ['duplicate declarations', hello.replace('var last:', 'var extra: string = ""; var extra:'), 'SW002'],
    ['wrong interface identity', hello.replace('component def Listener', 'interface senderReceiver Other version "1.0.0" { data text: string queued; } component def Listener').replace('port input: Greeting', 'port input: Other'), 'SW031'],
    ['undefined interface', hello.replace('port input: Greeting', 'port input: Missing'), undefined],
    ['zero capacity', hello.replace('capacity 4', 'capacity 0'), 'SW041'],
    ['legacy language header rejected', 'swaml "1.0"; ' + hello, undefined],
    ['no free events', 'package P { event E(); }', undefined],
    ['retired manual activation', 'package P { component Demo { function run() on manual {} } }', undefined],
    ['unrouted event activation', 'package P { component Demo { function run() on event requested {} } }', undefined],
    ['receive requires an owned port member', 'package P { component Demo { function run() on receive requested {} } }', 'SW050'],
    ['no performer syntax', 'package P { performer X; }', undefined],
    ['unknown view kind', hello.replace('overview gv', 'overview UNKNOWN_VIEW'), undefined],
    ['incomplete document is safe', 'package P { component def C { connect', undefined],
    ['wrong import', hello.replace('port output: Greeting', 'port output: Elsewhere::Greeting'), undefined],
    ['local data cannot escape component', hello.replace('send output.text("Hello, SWAML")', 'send output.text(listener.last)'), 'SW022'],
];
for (const [name, text, code] of failures) test(name, async () => {
    const d = await diagnostics(text);
    assert.ok(d.some(x => x.severity === 1 && (code === undefined || x.code === code)), JSON.stringify(d));
    assert.ok(!d.some(x => String(x.message).includes('error occurred during validation')), 'Validator must not crash on incomplete input');
});

test('manual is an ordinary identifier after retiring the activation keyword', async () => {
    assert.deepEqual(await diagnostics('package P { enum Mode { manual } component manual { var selected: Mode = Mode.manual; function run() on start { assert selected == Mode.manual; } } }'), []);
});

test('retired manual activation retains a syntax error and recovers to a later function', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)('package P { component Demo { function retired() on manual {} function recovered() on start { assert true; } } }', { validation: true });
    assert.ok(document.parseResult.parserErrors.length > 0);
    assert.ok(!document.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))));
    const root = document.parseResult.value.packages[0].elements.find(isRootComponent)!;
    const recovered = root.members.filter(isFunctionDef).find(fn => fn.name === 'recovered');
    assert.ok(recovered);
    assert.equal(recovered.trigger?.kind, 'start');
});
test('realtime WCET constraint', async () => {
    const d = await diagnostics(load('02-realtime-controller.swaml').replace('wcet 1 ms', 'wcet 30 ms'));
    assert.ok(d.some(x => x.code === 'SW042'));
});
test('realtime max age constraint', async () => {
    const d = await diagnostics(load('02-realtime-controller.swaml').replaceAll('maxAge 20 ms;', ''));
    assert.ok(d.some(x => x.code === 'SW044'));
});
test('service timeout failure must terminate', async () => {
    const d = await diagnostics(load('03-service-pubsub.swaml').replace('fail "checkout unavailable";', 'assert true;'));
    assert.ok(d.some(x => x.code === 'SW057'));
});
test('request must match the interface function', async () => {
    const d = await diagnostics(load('03-service-pubsub.swaml').replace('call orders.submit', 'call orders.accepted'));
    assert.ok(d.some(x => x.code === 'SW051'));
});
test('at-least-once request needs idempotency', async () => {
    const d = await diagnostics(load('03-service-pubsub.swaml').replaceAll('delivery atMostOnce', 'delivery atLeastOnce'));
    assert.ok(d.some(x => x.code === 'SW043'));
});
test('duplicate state transitions need priority', async () => {
    const text = load('04-stateful-function.swaml').replace('transition expire:', 'transition duplicate: Idle -> Running on receive commands.begin {} transition expire:');
    assert.ok((await diagnostics(text)).some(x => x.code === 'SW062'));
});
test('local call is scoped to the owning component', async () => {
    const text = hello.replace('send output.text("Hello, SWAML");', 'call hear("x");');
    assert.ok((await diagnostics(text)).some(x => String(x.message).includes('hear')));
});
test('imports resolve across documents', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const library = await parse('package Library { interface clientServer Api version "1.0.0" { function ping(): void; } }', { documentUri: 'file:///library.swaml' });
    const client = await parse('package Client { import Library::*; component def U { port api: Api client optional; function run(): void { call api.ping() as responseValue within 1 s otherwise { return; }; } } }', { documentUri: 'file:///client.swaml' });
    await shared.workspace.DocumentBuilder.build([library, client], { validation: true });
    assert.deepEqual(client.diagnostics, []);
});
test('unimported symbols cannot leak across documents', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const lib = await parse('package A { datatype Value { x: int; } }', { documentUri: 'file:///a.swaml' });
    const user = await parse('package B { datatype Box { x: Value; } }', { documentUri: 'file:///b.swaml' });
    await shared.workspace.DocumentBuilder.build([lib, user], { validation: true });
    assert.ok(user.diagnostics?.some(d => d.severity === 1));
});
for (const file of readdirSync(new URL('../../examples/invalid/', import.meta.url)).filter(f => f.endsWith('.swaml'))) {
    test(`invalid fixture ${file}`, async () => assert.ok((await diagnostics(load(`invalid/${file}`))).some(d => d.severity === 1)));
}
test('record field completeness', async () => {
    const d = await diagnostics(load('05-values-and-flow.swaml').replace('health = Health.Good;', ''));
    assert.ok(d.some(x => x.code === 'SW026'));
});
test('unknown enum literal', async () => {
    assert.ok((await diagnostics(load('05-values-and-flow.swaml').replace('Health.Good', 'Health.Missing'))).some(d => d.code === 'SW027'));
});
test('fixed array shape', async () => {
    assert.ok((await diagnostics(load('05-values-and-flow.swaml').replace('real[3]', 'real[4]'))).some(d => d.code === 'SW023'));
});
test('emission provenance is required', async () => {
    assert.ok((await diagnostics(hello.replace('send output.text("Hello, SWAML");', ''))).some(d => d.code === 'SW050'));
});
test('sampled data cannot silently queue history', async () => {
    assert.ok((await diagnostics(load('02-realtime-controller.swaml').replace('capacity 1', 'capacity 4'))).some(d => d.code === 'SW041'));
});
test('calculations cannot read mutable component state', async () => {
    const text = 'package P { component def U { var hidden: int = 1; function run() { calc f { return result: int = hidden; } } } }';
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW022'));
});
test('recursive local calls rejected', async () => {
    const text = 'package P { component def U { function a(): void { call b(); } function b(): void { call a(); } } }';
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW056'));
});
test('value-returning handler covers every branch', async () => {
    const text = load('03-service-pubsub.swaml').replace('return true;', 'if (orderId == "x") { return true; }');
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW053'));
});
test('unconditional completion cycle rejected', async () => {
    const text = load('04-stateful-function.swaml').replace('on receive commands.begin', 'on completion').replace('on receive commands.stop', 'on completion').replace('state Stopped final', 'state Stopped').replace('transition expire:', 'transition loop: Stopped -> Idle on completion {} transition expire:');
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW064'));
});
test('ambiguous imported names are rejected', async () => {
    const text = 'package A { datatype T { x: int; } } package B { datatype T { x: int; } } package C { import A::*; import B::*; datatype Use { value: T; } }';
    assert.ok((await diagnostics(text)).some(d => d.severity === 1));
});
test('duplicate connectors are rejected', async () => {
    const link = /connect greeting:[\s\S]*?};/.exec(hello)![0];
    assert.ok((await diagnostics(hello.replace(link, link + link.replace('greeting:', 'duplicate:')))).some(d => d.code === 'SW035'));
});
