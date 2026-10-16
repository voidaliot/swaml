import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, EmptyFileSystemProvider, URI, type LangiumDocument } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate } from '../src/simulation/simulator.js';

const policy = '{ delivery atMostOnce; ordering fifo; capacity 2; overflow reject; }';
const fixture = (name: string) => readFileSync(new URL(`../../examples/${name}.swaml`, import.meta.url), 'utf8');
const named = fixture('10-reusable-qos');
async function document(text: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    return parseHelper<Model>(Swaml)(text, { validation: true });
}
async function invalid(text: string, code?: string) {
    const doc = await document(text);
    assert.ok(doc.diagnostics?.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(doc.diagnostics));
    assert.ok(!doc.diagnostics?.some(d => String(d.message).includes('error occurred during validation')), JSON.stringify(doc.diagnostics));
}
async function workspace(texts: string[]): Promise<LangiumDocument<Model>[]> {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const docs: LangiumDocument<Model>[] = [];
    for (const [i, text] of texts.entries()) docs.push(await parse(text, { documentUri: `file:///qos-${i}.swaml` }));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    return docs;
}
const externalUser = named.replace(/qos def LocalEvents\s*\{[^}]*\}/, 'import Policies::*;').replace('view policy grv of LocalEvents;', '');
const library = `package Policies { qos def LocalEvents ${policy} }`;

test('named policy and inline QoS have identical observable traces and stores', async () => {
    const shared = await document(named);
    const inline = await document(named.replaceAll('qos LocalEvents', `qos ${policy}`));
    assert.deepEqual(shared.diagnostics, []); assert.deepEqual(inline.diagnostics, []);
    const a = simulate([shared.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20, latencyNs: 10 });
    const b = simulate([inline.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20, latencyNs: 10 });
    assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.stores, b.stores);
    assert.equal(a.stores.first.latest, 7); assert.equal(a.stores.second.latest, 7);
});

test('shared capacity-one policy retains independent connector queues', async () => {
    const doc = await document(named.replace('capacity 2;', 'capacity 1;'));
    assert.deepEqual(doc.diagnostics, []);
    const result = simulate([doc.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20, latencyNs: 10 });
    assert.equal(result.stores.first.latest, 7); assert.equal(result.stores.second.latest, 7);
    assert.equal(result.trace.filter(t => t.kind === 'delivery').length, 2);
    assert.ok(!result.trace.some(t => t.kind === 'reject'));
});

test('shared policy preserves per-instance storage and routes across reused component definitions', async () => {
    const doc = await document(named.replace('component Demo: Pair;', 'component Demo { component one: Pair; component two: Pair; }'));
    assert.deepEqual(doc.diagnostics, []);
    const result = simulate([doc.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20, latencyNs: 10 });
    for (const path of ['one.first', 'one.second', 'two.first', 'two.second']) assert.equal(result.stores[path].latest, 7);
    assert.equal(result.trace.filter(t => t.kind === 'delivery').length, 4);
});

test('policy imports resolve across documents and simulation requires the referenced source', async () => {
    const [lib, user] = await workspace([library, externalUser]);
    assert.deepEqual(lib.diagnostics, []); assert.deepEqual(user.diagnostics, []);
    const result = simulate([lib.parseResult.value, user.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20 });
    assert.equal(result.stores.second.latest, 7);
    assert.throws(() => simulate([user.parseResult.value], 'ReusablePolicies::Demo', { untilNs: 20 }), /every referenced document/);
});

test('qualified policies resolve without import and disambiguate competing imported kinds', async () => {
    for (const imports of ['', 'import Policies::*; import Other::*;']) {
        const docs = await workspace([library, 'package Other { datatype LocalEvents {} }', externalUser.replace('import Policies::*;', imports).replaceAll('qos LocalEvents', 'qos Policies::LocalEvents')]);
        for (const doc of docs) assert.deepEqual(doc.diagnostics, []);
    }
});

for (const [label, sources] of [
    ['missing import', [library, externalUser.replace('import Policies::*;', '')]],
    ['unknown policy', [externalUser.replace('import Policies::*;', '')]],
    ['ambiguous imports', [library, `package Other { qos def LocalEvents ${policy} }`, externalUser.replace('import Policies::*;', 'import Policies::*; import Other::*;')]],
    ['ambiguity across declaration kinds', [library, 'package Other { datatype LocalEvents {} }', externalUser.replace('import Policies::*;', 'import Policies::*; import Other::*;')]],
    ['wrong declaration kind', ['package Policies { datatype LocalEvents {} }', externalUser]],
    ['transitive import leakage', [library, 'package Bridge { import Policies::*; }', externalUser.replace('import Policies::*;', 'import Bridge::*;')]],
] as [string, string[]][]) test(`named policy rejects ${label}`, async () => {
    const docs = await workspace(sources);
    assert.ok(docs.at(-1)?.diagnostics?.some(d => d.severity === 1));
});

test('unused policies still validate capacity and duration bounds', async () => {
    await invalid('package P { qos def Invalid { delivery atMostOnce; ordering fifo; capacity 0; overflow reject; } }', 'SW041');
    await invalid('package P { qos def Invalid { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; maxAge 0 ns; } }', 'SW040');
});
test('named at-least-once RPC still requires every function to be idempotent', async () => {
    const text = fixture('07-client-server').replace('package Rpc {', 'package Rpc { qos def Retries { delivery atLeastOnce; ordering fifo; capacity 4; overflow reject; }').replace(/qos\s*\{[^}]*\}/g, 'qos Retries');
    assert.deepEqual((await document(text)).diagnostics, []);
    await invalid(text.replace(' idempotent', ''), 'SW043');
});

const realtime = fixture('02-realtime-controller').replace(/qos\s*\{[^}]*\}/g, 'qos SamplesPolicy').replace('package Control {', 'package Control { qos def SamplesPolicy { delivery atMostOnce; ordering fifo; capacity 1; overflow dropOldest; maxLatency 1 ms; maxAge 20 ms; }');
test('named sampled/realtime policy obeys unchanged contextual validation', async () => {
    assert.deepEqual((await document(realtime)).diagnostics, []);
    await invalid(realtime.replace('capacity 1;', 'capacity 2;'), 'SW041');
    await invalid(realtime.replace('overflow dropOldest;', 'overflow reject;'), 'SW041');
    await invalid(realtime.replace('maxLatency 1 ms;', ''), 'SW044');
    await invalid(realtime.replace('maxAge 20 ms;', ''), 'SW044');
});

for (const [label, text] of [
    ['missing member', 'package P { qos def Incomplete { delivery atMostOnce; capacity 1; overflow reject; } }'],
    ['missing name', `package P { qos def ${policy} }`],
    ['unfinished policy', 'package P { qos def Incomplete { delivery atMostOnce;'],
    ['unfinished reference', named.replace('qos LocalEvents;', 'qos ;')],
    ['inline override', named.replace('qos LocalEvents;', `qos LocalEvents ${policy};`)],
    ['policy inheritance', `package P { qos def Base ${policy} qos def Derived Base }`],
    ['nested definition', `package P { component def C { qos def Nested ${policy} } }`],
    ['duplicate policy name', `package P { qos def Same ${policy} qos def Same ${policy} }`],
] as const) test(`policy parser/validation rejects ${label} without crashing`, () => invalid(text));

class MemoryFiles extends EmptyFileSystemProvider {
    constructor(readonly files: Map<string, string>) { super(); }
    override async readFile(uri?: URI) { return this.files.get(uri!.toString())!; }
    override async stat(uri: URI) { return { uri, isFile: true, isDirectory: false }; }
}
test('policy edits, newly ambiguous imports and deletion revalidate dependent connectors', async () => {
    const libUri = URI.parse('file:///policies.swaml'), userUri = URI.parse('file:///architecture.swaml'), otherUri = URI.parse('file:///other-policy.swaml');
    const user = externalUser.replace('import Policies::*;', 'import Policies::*; import Other::*;');
    const files = new Map([[libUri.toString(), library], [userUri.toString(), user], [otherUri.toString(), 'package Other {}']]);
    const { shared } = createSwamlServices({ fileSystemProvider: () => new MemoryFiles(files) });
    const docs = await Promise.all([...files.keys()].map(uri => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(uri))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    const userDoc = shared.workspace.LangiumDocuments.getDocument(userUri)!;
    assert.equal(userDoc.diagnostics?.length, 0);
    files.set(otherUri.toString(), 'package Other { datatype LocalEvents {} }');
    await shared.workspace.DocumentBuilder.update([otherUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.severity === 1));
    files.set(otherUri.toString(), 'package Other {}');
    await shared.workspace.DocumentBuilder.update([otherUri], []);
    assert.equal(userDoc.diagnostics?.length, 0);
    files.set(libUri.toString(), library.replace('LocalEvents', 'Renamed'));
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.severity === 1));
    files.set(libUri.toString(), library);
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.equal(userDoc.diagnostics?.length, 0);
    files.delete(libUri.toString());
    await shared.workspace.DocumentBuilder.update([], [libUri]);
    assert.ok(userDoc.diagnostics?.some(d => d.code === 'SW004'));
});
