import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate } from '../src/simulation/simulator.js';

const program = (body: string, members = '') => `package P { component Demo { var result: int = 0; ${members} function run() on start { ${body} } } }`;
async function parse(source: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(source, { validation: true });
    assert.ok(!doc.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(doc.diagnostics));
    return doc;
}
async function run(body: string, members = '') {
    const doc = await parse(program(body, members));
    assert.deepEqual(doc.diagnostics, []);
    return simulate([doc.parseResult.value], 'P::Demo', { untilNs: 1 });
}
const hasFailure = (result: ReturnType<typeof simulate>, code: string) => result.trace.some(t => t.kind === 'failure' && t.code === code);

test('for initializes once, updates after its body and leaves no header binding behind', async () => {
    const result = await run('for (var i: int = 0; i < 3; i = i + 1) bound 3 { var fresh: int = i; result = result + fresh; } var i: int = 10; result = result + i;');
    assert.equal(result.stores[''].result, 13);
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.trace.filter(t => t.kind === 'statement' && t.kindOfStatement === 'Assign').length, 7);
});

test('for skips body and update when its first condition is false', async () => {
    const result = await run('for (var i: int = 0; false; result = result + 100) bound 1 { result = result + 1; }');
    assert.equal(result.stores[''].result, 0);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('for evaluates initializer even when its first condition is false', async () => {
    const result = await run('for (var i: real = 1 / 0; false; i = i + 1) bound 1 {}');
    assert.ok(hasFailure(result, 'Arithmetic'));
});

test('for permits its final update and fails before an extra body', async () => {
    const result = await run('for (var i: int = 0; result < 4; updates = updates + 1) bound 3 { result = result + 1; }', 'var updates: int = 0;');
    assert.equal(result.stores[''].result, 3);
    assert.equal(result.stores[''].updates, 3);
    assert.ok(hasFailure(result, 'LoopBound'));
});

test('forEach iterates a copied fixed-array snapshot with fresh copied item values', async () => {
    const result = await run('forEach (item: int in values) { var fresh: int = item; values = [9, 9, 9]; result = result + fresh; item = 100; } var item: int = 1; result = result + item;', 'var values: int[3] = [1, 2, 3];');
    assert.equal(result.stores[''].result, 7);
    assert.deepEqual(result.stores[''].values, [9, 9, 9]);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('forEach checks each copied value against the item type at runtime', async () => {
    const result = await run('forEach (item: byte in values) { result = result + item; }', 'var values: int[2] = [1, -1];');
    assert.equal(result.stores[''].result, 1);
    assert.ok(hasFailure(result, 'Bounds'));
});

test('forEach accepts assignment-compatible numeric item types and pure array results', async () => {
    const result = await run('calc values { return entries: int[3] = [1, 2, 3]; } var sum: real = 0.0; forEach (item: real in values()) { sum = sum + item; } assert sum == 6.0;');
    assert.equal(result.outcome, 'no-failure-observed');
});

test('do while executes once for an initially false condition', async () => {
    const result = await run('do { result = result + 1; } while (false) bound 1;');
    assert.equal(result.stores[''].result, 1);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('do while checks the condition after its final permitted body', async () => {
    const exact = await run('do { var fresh: int = 1; result = result + fresh; } while (result < 3) bound 3;');
    assert.equal(exact.stores[''].result, 3);
    assert.equal(exact.outcome, 'no-failure-observed');
    const excess = await run('do { result = result + 1; } while (true) bound 3;');
    assert.equal(excess.stores[''].result, 3);
    assert.ok(hasFailure(excess, 'LoopBound'));
});

test('mixed nested loops reset their independent counters at each entry', async () => {
    const result = await run('for (var i: int = 0; i < 3; i = i + 1) bound 3 { forEach (item: int in [1, 2]) { var j: int = 0; do { result = result + item; j = j + 1; } while (j < 2) bound 2; } }');
    assert.equal(result.stores[''].result, 18);
    assert.equal(result.outcome, 'no-failure-observed');
});

for (const [kind, body] of [
    ['for', 'for (var i: int = 0; true; result = 99) bound 1 { result = 1; return; }'],
    ['forEach', 'forEach (item: int in [1, 2]) { result = item; return; }'],
    ['do while', 'do { result = 1; return; } while (true) bound 1;'],
] as const) test(`${kind} body return exits its function before update or further conditions`, async () => {
    const result = await run(`${body} result = 100;`);
    assert.equal(result.stores[''].result, 1);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('unconditionally returning do while and nonempty forEach bodies satisfy result coverage', async () => {
    const result = await run('call postTest() as a; call elements() as b; result = a + b;', 'function postTest(): int { do { return 2; } while (true) bound 1; } function elements(): int { forEach (item: int in [3, 4]) { return item; } }');
    assert.equal(result.stores[''].result, 5);
    assert.equal(result.outcome, 'no-failure-observed');
});

test('forEach resolves imported nominal item types and copied record fields', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem), read = parseHelper<Model>(Swaml);
    const library = await read('package Library { datatype Item { value: int; } }', { documentUri: 'file:///loop-types.swaml' });
    const application = await read('package Application { import Library::*; component Demo { var result: int = 0; var values: Item[2] = [record Item { value = 2; }, record Item { value = 3; }]; function run() on start { forEach (item: Library::Item in values) { result = result + item.value; item = record Item { value = 100; }; } } } }', { documentUri: 'file:///loop-app.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    assert.deepEqual(library.diagnostics, []);
    assert.deepEqual(application.diagnostics, []);
    const result = simulate([library.parseResult.value, application.parseResult.value], 'Application::Demo', { untilNs: 1 });
    assert.equal(result.stores[''].result, 5);
    assert.deepEqual(result.stores[''].values, [{ value: 2 }, { value: 3 }]);
});

for (const [name, body, code] of [
    ['for initializer type', 'for (var i: int = "wrong"; true; i = i + 1) bound 1 {}', 'SW023'],
    ['for initializer self reference', 'for (var i: int = i; false; i = 1) bound 1 {}', 'SW022'],
    ['for header shadow', 'var i: int = 0; for (var i: int = 0; false; i = 1) bound 1 {}', 'SW002'],
    ['for condition type', 'for (var i: int = 0; i; i = i + 1) bound 1 {}', 'SW023'],
    ['for update type', 'for (var i: int = 0; true; i = "wrong") bound 1 {}', 'SW023'],
    ['for unknown update target', 'for (var i: int = 0; true; missing = 1) bound 1 {}', 'SW022'],
    ['for update body local', 'for (var i: int = 0; true; fresh = 1) bound 1 { var fresh: int = 0; }', 'SW022'],
    ['for header scope leak', 'for (var i: int = 0; false; i = 1) bound 1 {} assert i == 0;', 'SW022'],
    ['for zero bound', 'for (var i: int = 0; false; i = 1) bound 0 {}', 'SW059'],
    ['for unsafe bound', 'for (var i: int = 0; false; i = 1) bound 9007199254740992 {}', 'SW059'],
    ['forEach scalar collection', 'forEach (item: int in 1) {}', 'SW023'],
    ['forEach empty array', 'forEach (item: int in []) {}', 'SW028'],
    ['forEach incompatible item type', 'forEach (item: bool in [1, 2]) {}', 'SW023'],
    ['forEach constant item range', 'forEach (item: byte in [1, -1]) {}', 'SW025'],
    ['forEach void item', 'forEach (item: void in [1]) {}', 'SW020'],
    ['forEach shadow', 'var item: int = 0; forEach (item: int in [1]) {}', 'SW002'],
    ['forEach item scope leak', 'forEach (item: int in [1]) {} assert item == 1;', 'SW022'],
    ['forEach source cannot use its item', 'forEach (item: int in [item]) {}', 'SW022'],
    ['do condition type', 'do {} while (1) bound 1;', 'SW023'],
    ['do body local condition', 'do { var fresh: bool = false; } while (fresh) bound 1;', 'SW022'],
    ['do zero bound', 'do {} while (false) bound 0;', 'SW059'],
    ['do unsafe bound', 'do {} while (false) bound 9007199254740992;', 'SW059'],
] as const) test(`reject ${name}`, async () => {
    const doc = await parse(program(body));
    assert.ok(doc.diagnostics?.some(d => d.code === code), JSON.stringify(doc.diagnostics));
});

test('for update assignments preserve transitive reentrant write restrictions', async () => {
    const doc = await parse('package P { component Demo { var changed: int = 0; function helper() { for (var i: int = 0; i < 2; changed = changed + 1) bound 2 { i = i + 1; } } function run() on start timing { wcet 1 ms; deadline 2 ms; concurrency reentrant; } { call helper(); } } }');
    assert.ok(doc.diagnostics?.some(d => d.code === 'SW054'), JSON.stringify(doc.diagnostics));
});

for (const body of [
    'for (var i: int = 0; i < 3; i = i + 1) {}',
    'for (i = 0; i < 3; i = i + 1) bound 3 {}',
    'for (var i: int = 0; i < 3; i++) bound 3 {}',
    'for (var i: int = 0; i < 3; i = i + 1) bound -1 {}',
    'for (var i: int = 0; i < 3; i = i + 1) bound 1.5 {}',
    'for (var i: int = 0; ; i = i + 1) bound 3 {}',
    'for (var i: int = 0; i < 3; i = i + 1) bound 3 {',
    'forEach (item in [1, 2]) {}',
    'forEach (item: int of [1, 2]) {}',
    'forEach (item: int in [1, 2]) bound 2 {}',
    'forEach (item: int in [1, 2]) {',
    'do {} while (false) bound 1',
    'do {} while (false);',
    'do {} while (false) bound -1;',
    'do {} while (false) bound 1.5;',
    'do {} (false) bound 1;',
    'while (true) bound 1 { break; }',
    'while (true) bound 1 { continue; }',
]) test(`reject malformed loop safely: ${body}`, async () => {
    const doc = await parse(program(body));
    assert.ok(doc.parseResult.parserErrors.length > 0);
    assert.ok(doc.diagnostics?.some(d => d.severity === 1));
});
