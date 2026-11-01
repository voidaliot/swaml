import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, URI } from 'langium';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { SWAML_IMPLEMENTATION_VERSION, SWAML_LANGUAGE_VERSION } from '../../src/language/edition.js';
test('the edition module matches the standard and the package version', () => {
    const json = (path: string) => JSON.parse(readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'));
    assert.equal(SWAML_LANGUAGE_VERSION, json('spec/standard.json').version);
    assert.equal(SWAML_IMPLEMENTATION_VERSION, json('package.json').version);
});
test('view inventories refresh after source replacement, addition and deletion', async () => {
    const services = createSwamlServices(EmptyFileSystem), { LangiumDocuments: documents, LangiumDocumentFactory: factory, DocumentBuilder: builder } = services.shared.workspace;
    const uri = URI.parse('memory:///views.swaml');
    const load = (name: string) => {
        const doc = factory.fromString(`package Test { import Swaml::Views; component ${name} { } view v: General of Demo; }`, uri);
        documents.addDocument(doc);
        return doc;
    };
    const first = load('Demo');
    await builder.build([first], { validation: true });
    assert.ok(!first.diagnostics?.some(d => d.severity === 1));
    documents.deleteDocument(uri);
    const next = load('Other');
    await builder.build([next], { validation: true });
    assert.ok(next.diagnostics?.some(d => d.code === 'SW2010'));
    const extraUri = URI.parse('memory:///extra.swaml'), extra = factory.fromString('package Extra { component Demo { } }', extraUri);
    documents.addDocument(extra);
    documents.deleteDocument(uri);
    const consumer = factory.fromString('package Test { import Swaml::Views; import Extra; view v: General of Demo; }', uri);
    documents.addDocument(consumer);
    await builder.build([consumer, extra], { validation: true });
    assert.ok(!consumer.diagnostics?.some(d => d.severity === 1));
    builder.updateBuildOptions = { validation: true };
    await builder.update([], [extraUri]);
    assert.ok(consumer.diagnostics?.some(d => d.code === 'SW2010'));
});
const main = fileURLToPath(new URL('../../src/cli/main.js', import.meta.url));
function rpc() { const p = spawn(process.execPath, [fileURLToPath(new URL('../../src/server/main.js', import.meta.url)), '--stdio'], { stdio: 'pipe' }); let buffer = Buffer.alloc(0), id = 0; const pending = new Map<number, (v: any) => void>(), notifications: any[] = []; p.stdout.on('data', (chunk: Buffer) => { buffer = Buffer.concat([buffer, chunk]); while (true) {
    const at = buffer.indexOf('\r\n\r\n');
    if (at < 0)
        break;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, at).toString())?.[1]);
    if (buffer.length < at + 4 + length)
        break;
    const m = JSON.parse(buffer.subarray(at + 4, at + 4 + length).toString());
    buffer = buffer.subarray(at + 4 + length);
    if (m.id !== undefined) {
        pending.get(m.id)?.(m);
        pending.delete(m.id);
    }
    else
        notifications.push(m);
} }); const send = (m: unknown) => { const text = JSON.stringify(m); p.stdin.write(`Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`); }; const request = (method: string, params: unknown) => new Promise<any>((resolve, reject) => { const n = ++id, t = setTimeout(() => reject(Error('LSP request timed out: ' + method)), 8000); pending.set(n, m => { clearTimeout(t); resolve(m); }); send({ jsonrpc: '2.0', id: n, method, params }); }); return { p, send, request, notifications }; }
test('LSP advertises 2.1 and rejects unsupported parser selection', async () => { for (const version of ['2.1', '2.0', '1.4']) {
    const r = rpc();
    try {
        const result = await r.request('initialize', { processId: null, rootUri: null, capabilities: {}, initializationOptions: { languageVersion: version } });
        if (version === '2.1') {
            assert.equal(result.result.serverInfo.version, JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version);
            assert.deepEqual(result.result.capabilities.experimental.swaml, { languageVersion: '2.1', profile: 'swaml-reference/2.1' });
            await r.request('shutdown', null);
            r.send({ jsonrpc: '2.0', method: 'exit' });
        }
        else
            assert.equal(result.error.code, -32602);
    }
    finally {
        r.p.kill();
    }
} });
test('CLI emits structured diagnostics and distinct invocation errors', () => { const run = (args: string[]) => spawnSync(process.execPath, [main, ...args], { encoding: 'utf8', timeout: 10000 }); const good = run(['--json', 'examples/01-hello.swaml']); assert.equal(good.status, 0); assert.equal(JSON.parse(good.stdout).languageVersion, '2.1'); const bad = run(['--json', 'examples/invalid/bypass-port.swaml']); assert.equal(bad.status, 1); const diagnostics = JSON.parse(bad.stdout).diagnostics; assert.ok(diagnostics.some((d: any) => d.code === 'SW2002' && d.range && d.data.declaration)); assert.equal(run(['--language-version', '1.4', 'examples/01-hello.swaml']).status, 2); assert.equal(run(['--language-version', '2.0', 'examples/01-hello.swaml']).status, 2); assert.equal(run(['--language-version', '2.1', 'examples/01-hello.swaml']).status, 0); assert.equal(run([]).status, 2); });
test('the shipped standard library is itself linked and validated', async () => { const { shared } = createSwamlServices(EmptyFileSystem), docs = shared.workspace.LangiumDocuments.all.toArray(); await shared.workspace.DocumentBuilder.build(docs, { validation: true }); assert.deepEqual(docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []); });
test('adding a newly ambiguous imported declaration revalidates negative lookups', async () => { const rawSources: [
    string,
    string
][] = [['memory:///a.swaml', 'package A { datatype R { v: int; } }'], ['memory:///b.swaml', 'package B { }'], ['memory:///test.swaml', 'package Test { import A; import B; component Demo { attribute r: R = record R { v = 1; }; } }']]; const sources = new Map(rawSources.map(([path, text]) => [URI.parse(path).toString(), text])); const fs = { fileSystemProvider: () => Object.assign(EmptyFileSystem.fileSystemProvider(), { readFile: async (uri: URI) => { const text = sources.get(uri.toString()); if (text === undefined)
            throw Error('Missing memory source'); return text; }, readDirectory: async () => [] }) }; const { shared } = createSwamlServices(fs); const docs = await Promise.all([...sources.keys()].map(s => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(s)))); await shared.workspace.DocumentBuilder.build(docs, { validation: true }); assert.deepEqual(docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []); sources.set(URI.parse('memory:///b.swaml').toString(), 'package B { datatype R { v: int; } }'); await shared.workspace.DocumentBuilder.update([URI.parse('memory:///b.swaml')], []); assert.ok(docs[2].diagnostics?.some(d => d.severity === 1), 'existing short reference must become ambiguous'); });
test('hosts inject authoring providers while retaining the pinned core validator', async () => {
    const marker = { formatOnTypeOptions: undefined, formatDocument: async () => [], formatDocumentRange: async () => [], formatDocumentOnType: async () => [] };
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem, { lsp: { Formatter: () => marker } });
    assert.equal(Swaml.lsp.Formatter, marker);
    const doc = shared.workspace.LangiumDocumentFactory.fromString('package Test { component Demo { attribute value: int = false; } }', URI.parse('memory:///host.swaml'));
    shared.workspace.LangiumDocuments.addDocument(doc);
    await shared.workspace.DocumentBuilder.build([doc], { validation: true });
    assert.ok(doc.diagnostics?.some(d => d.code === 'SW2002'));
});

