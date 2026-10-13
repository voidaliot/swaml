import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';

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
    ['cross-unit member access', hello.replace('send output.text(', 'send listener.input.text('), 'SW050'],
    ['wrong communication verb', hello.replace('send output.text(', 'publish output.text('), 'SW051'],
    ['sender used as receiver', hello.replace('Greeting receiver', 'Greeting sender'), 'SW032'],
    ['payload type mismatch', hello.replace('"Hello, SWAML"', '42'), 'SW023'],
    ['handler mismatch', hello.replace('message: String', 'message: Int'), 'SW052'],
    ['missing handler', hello.replace('on receive input.text', 'on manual').replace('hear(message: String)', 'hear()').replace('set last = message;', ''), 'SW055'],
    ['unconnected port', hello.replace(/connect greeting:[\s\S]*?};/, ''), 'SW034'],
    ['duplicate declarations', hello.replace('var last:', 'var extra: String = ""; var extra:'), 'SW002'],
    ['wrong interface identity', hello.replace('unit def Listener', 'interface senderReceiver Other version "1.0.0" { data text: String queued; } unit def Listener').replace('port input: Greeting', 'port input: Other'), 'SW031'],
    ['undefined interface', hello.replace('port input: Greeting', 'port input: Missing'), undefined],
    ['zero capacity', hello.replace('capacity 4', 'capacity 0'), 'SW041'],
    ['wrong language version', hello.replace('swaml "1.0"', 'swaml "9.0"'), 'SW001'],
    ['no free events', 'swaml "1.0"; package P { event E(); }', undefined],
    ['no performer syntax', 'swaml "1.0"; package P { performer X; }', undefined],
    ['no geometry view', hello.replace('overview GV', 'overview GEV'), undefined],
    ['incomplete document is safe', 'swaml "1.0"; package P { component def C { connect', undefined],
    ['wrong import', hello.replace('port output: Greeting', 'port output: Elsewhere::Greeting'), undefined],
    ['local data cannot escape unit', hello.replace('send output.text("Hello, SWAML")', 'send output.text(listener.last)'), 'SW022'],
];
for (const [name, text, code] of failures) test(name, async () => {
    const d = await diagnostics(text);
    assert.ok(d.some(x => x.severity === 1 && (code === undefined || x.code === code)), JSON.stringify(d));
    assert.ok(!d.some(x => String(x.message).includes('error occurred during validation')), 'Validator must not crash on incomplete input');
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
test('request must match the interface operation', async () => {
    const d = await diagnostics(load('03-service-pubsub.swaml').replace('request orders.submit', 'request orders.accepted'));
    assert.ok(d.some(x => x.code === 'SW051'));
});
test('at-least-once request needs idempotency', async () => {
    const d = await diagnostics(load('03-service-pubsub.swaml').replaceAll('delivery atMostOnce', 'delivery atLeastOnce'));
    assert.ok(d.some(x => x.code === 'SW043'));
});
test('duplicate state transitions need priority', async () => {
    const text = load('04-stateful-operation.swaml').replace('transition expire:', 'transition duplicate: Idle -> Running on receive commands.begin {} transition expire:');
    assert.ok((await diagnostics(text)).some(x => x.code === 'SW062'));
});
test('local invoke is scoped to the owning unit', async () => {
    const text = hello.replace('send output.text("Hello, SWAML");', 'invoke hear("x");');
    assert.ok((await diagnostics(text)).some(x => String(x.message).includes('hear')));
});
test('imports resolve across documents', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const library = await parse('swaml "1.0"; package Library { interface clientServer Api version "1.0.0" { operation ping(): Void; } }', { documentUri: 'file:///library.swaml' });
    const client = await parse('swaml "1.0"; package Client { import Library::*; unit def U { port api: Api client optional; operation run(): Void { request api.ping() as responseValue within 1 s otherwise { return; }; } } }', { documentUri: 'file:///client.swaml' });
    await shared.workspace.DocumentBuilder.build([library, client], { validation: true });
    assert.deepEqual(client.diagnostics, []);
});
test('unimported symbols cannot leak across documents', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const lib = await parse('swaml "1.0"; package A { datatype Value { x: Int; } }', { documentUri: 'file:///a.swaml' });
    const user = await parse('swaml "1.0"; package B { datatype Box { x: Value; } }', { documentUri: 'file:///b.swaml' });
    await shared.workspace.DocumentBuilder.build([lib, user], { validation: true });
    assert.ok(user.diagnostics?.some(d => d.severity === 1));
});
for (const file of readdirSync(new URL('../../examples/invalid/', import.meta.url)).filter(f => f.endsWith('.swaml'))) {
    test(`invalid fixture ${file}`, async () => assert.ok((await diagnostics(load(`invalid/${file}`))).some(d => d.severity === 1)));
}
test('record field completeness', async () => {
    const d = await diagnostics(load('05-values-and-flow.swaml').replace('health = enumValue Health.Good;', ''));
    assert.ok(d.some(x => x.code === 'SW026'));
});
test('unknown enum literal', async () => {
    assert.ok((await diagnostics(load('05-values-and-flow.swaml').replace('Health.Good', 'Health.Missing'))).some(d => d.code === 'SW027'));
});
test('fixed array shape', async () => {
    assert.ok((await diagnostics(load('05-values-and-flow.swaml').replace('Real[3]', 'Real[4]'))).some(d => d.code === 'SW023'));
});
test('emission provenance is required', async () => {
    assert.ok((await diagnostics(hello.replace('send output.text("Hello, SWAML");', ''))).some(d => d.code === 'SW050'));
});
test('sampled data cannot silently queue history', async () => {
    assert.ok((await diagnostics(load('02-realtime-controller.swaml').replace('capacity 1', 'capacity 4'))).some(d => d.code === 'SW041'));
});
test('pure functions cannot read mutable unit state', async () => {
    const text = 'swaml "1.0"; package P { unit def U { var hidden: Int = 1; function f(): Int = hidden; } }';
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW022'));
});
test('recursive local calls rejected', async () => {
    const text = 'swaml "1.0"; package P { unit def U { operation a(): Void { invoke b(); } operation b(): Void { invoke a(); } } }';
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW056'));
});
test('value-returning handler covers every branch', async () => {
    const text = load('03-service-pubsub.swaml').replace('return true;', 'if (orderId == "x") { return true; }');
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW053'));
});
test('unconditional completion cycle rejected', async () => {
    const text = load('04-stateful-operation.swaml').replace('on receive commands.begin', 'on completion').replace('on receive commands.stop', 'on completion').replace('state Stopped final', 'state Stopped').replace('transition expire:', 'transition loop: Stopped -> Idle on completion {} transition expire:');
    assert.ok((await diagnostics(text)).some(d => d.code === 'SW064'));
});
test('ambiguous imported names are rejected', async () => {
    const text = 'swaml "1.0"; package A { datatype T { x: Int; } } package B { datatype T { x: Int; } } package C { import A::*; import B::*; datatype Use { value: T; } }';
    assert.ok((await diagnostics(text)).some(d => d.severity === 1));
});
test('duplicate connectors are rejected', async () => {
    const link = /connect greeting:[\s\S]*?};/.exec(hello)![0];
    assert.ok((await diagnostics(hello.replace(link, link + link.replace('greeting:', 'duplicate:')))).some(d => d.code === 'SW035'));
});
