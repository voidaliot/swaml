import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, EmptyFileSystemProvider, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';

const model = (body: string) => `swaml "1.0"; package P { ${body} }`;
const unit = (body: string) => model(`unit def U { ${body} }`);
const fixture = (file: string) => readFileSync(new URL(`../../examples/${file}.swaml`, import.meta.url), 'utf8');
async function diagnostics(text: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    return (await parseHelper<Model>(Swaml)(text, { validation: true })).diagnostics ?? [];
}
async function invalid(text: string, code?: string) {
    const ds = await diagnostics(text);
    assert.ok(ds.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(ds));
    assert.ok(!ds.some(d => String(d.message).includes('error occurred during validation')), JSON.stringify(ds));
}
const rpc = fixture('07-client-server');
for (const [title, body] of [
    ['unknown escape', String.raw`var s: String = "\q";`],
    ['raw newline', 'var s: String = "line\nbreak";'],
    ['raw tab', 'var s: String = "tab\there";'],
    ['raw control', 'var s: String = "null\u0000here";']
]) test(`portable strings reject ${title}`, () => invalid(unit(body)));
test('portable escapes decode without loss', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(model(String.raw`requirement Text "\"\\\n\r\t";`), { validation: true });
    assert.deepEqual(doc.diagnostics, []);
    const element = doc.parseResult.value.packages[0].elements[0];
    assert.ok('text' in element);
    assert.equal(element.text, '"\\\n\r\t');
});
test('ambiguity includes declarations of different kinds', () => invalid('swaml "1.0"; package A { datatype T {} } package B { interface senderReceiver T version "1.0.0" { data x: Int queued; } } package C { import A::*; import B::*; datatype Use { value: T; } }'));
test('qualified names disambiguate different declaration kinds', async () => assert.deepEqual(await diagnostics('swaml "1.0"; package A { datatype T {} } package B { interface senderReceiver T version "1.0.0" { data x: Int queued; } } package C { import A::*; import B::*; datatype Use { value: A::T; } }'), []));
for (const index of ['-1', '2', '-(-2)']) test(`constant array bound ${index}`, () => invalid(unit(`var xs: Int[2] = array [1, 2]; operation run(): Void { let x: Int = xs[${index}]; }`), 'SW025'));
test('legal array endpoints', async () => assert.deepEqual(await diagnostics(unit('var xs: Int[2] = array [1, 2]; operation run(): Void { let a: Int = xs[0]; let b: Int = xs[1]; }')), []));
test('failure binding cannot overwrite user data', () => invalid(rpc.replace('var healthy:', 'var failure: String = ""; var healthy:'), 'SW002'));
test('Void request completion cannot be used as a value', () => invalid(rpc.replace('check(): Bool', 'check(): Void').replace('checkHealth(): Bool', 'checkHealth(): Void').replace('return true;', 'return;'), 'SW022'));
test('Void request completion may be discarded', async () => assert.deepEqual(await diagnostics(rpc.replace('check(): Bool', 'check(): Void').replace('checkHealth(): Bool', 'checkHealth(): Void').replace('return true;', 'return;').replace('set healthy = statusValue;', '')), []));
test('Void cannot be returned as an expression', () => invalid(unit('operation run(): Void { return true; }'), 'SW023'));
test('function parameters do not shadow private state', () => invalid(unit('var x: Int = 0; function f(x: Int): Int = x;'), 'SW002'));
const reentrant = 'operation run(): Void on manual timing { wcet 1 ms; deadline 5 ms; concurrency reentrant; } { invoke helper(); }';
test('reentrant transitive writes rejected', () => invalid(unit(`var x: Int = 0; ${reentrant} operation helper(): Void { invoke mutate(); } operation mutate(): Void { set x = 1; }`), 'SW054'));
test('reentrant read-only helper chains allowed', async () => assert.deepEqual(await diagnostics(unit(`var x: Int = 0; ${reentrant} operation helper(): Void { invoke read(); } operation read(): Void { assert x == 0; }`)), []));
test('recursive reentrant helper does not crash analysis', () => invalid(unit(`${reentrant} operation helper(): Void { invoke helper(); }`), 'SW056'));
const reply = 'reply serviceUnit.health.check -> caller.health.check via healthCheck after sent label answered;';
const request = 'request caller.health.check -> serviceUnit.health.check via healthCheck label sent;';
test('reply requires causal predecessor', () => invalid(rpc.replace('after sent label answered', 'label answered'), 'SW083'));
test('request has only one reply', () => invalid(rpc.replace(reply, `${reply} ${reply.replace('after sent label answered', 'after answered label twice')}`), 'SW083'));
test('ambiguous outstanding requests rejected', () => invalid(rpc.replace(request, `${request} ${request.replace('label sent', 'after sent label second')}`).replace('after sent label answered', 'after second label answered'), 'SW083'));
test('ordered request reply pairs allowed', async () => assert.deepEqual(await diagnostics(rpc.replace(reply, `${reply} ${request.replace('label sent', 'after answered label second')} ${reply.replace('after sent label answered', 'after second label done')}`)), []));
test('pubsub cannot publish backwards', () => invalid(fixture('03-service-pubsub').replace('publish backend.audit.recorded -> archive.input.recorded', 'publish archive.input.recorded -> backend.audit.recorded'), 'SW082'));
for (const [kind, subject] of [['IV', 'U'], ['CV', 'U'], ['SV', 'U'], ['FV', 'U'], ['GV', 'another'], ['GRV', 'another']]) test(`${kind} rejects wrong subject ${subject}`, () => invalid(model(`unit def U {} view another GV of U; view bad ${kind} of ${subject};`), 'SW080'));
test('package and instance view subjects', async () => assert.deepEqual(await diagnostics(model('unit def U { operation run(): Void {} } component def C { unit child: U; } system S service { component root: C; } view pkg GV of P; view grid GRV of P; view wiring IV of S.root; view flow FV of S.root.child.run;')), []));
test('required boundary alias cannot be weakened by optional leaf', () => invalid(model('interface publishSubscribe I version "1.0.0" { event e(); } unit def U { port p: I publisher optional; operation run(): Void { publish p.e(); } } component def C { port p: I publisher; unit child: U; delegate p -> child.p; } system S service { component root: C; }'), 'SW034'));
test('unsafe transition priority rejected', () => invalid(fixture('04-stateful-operation').replace('on receive commands.begin', 'on receive commands.begin priority 9007199254740992'), 'SW062'));

class MemoryFiles extends EmptyFileSystemProvider {
    constructor(readonly files: Map<string, string>) { super(); }
    override async readFile(uri?: URI) { return this.files.get(uri!.toString())!; }
    override async stat(uri: URI) { return { uri, isFile: true, isDirectory: false }; }
}
test('editor updates revalidate negative lookups, paths and deletion across files', async () => {
    const libUri = URI.parse('file:///library.swaml'), userUri = URI.parse('file:///user.swaml'), otherUri = URI.parse('file:///other.swaml');
    const library = 'swaml "1.0"; package Library { unit def U { operation run(): Void {} } component def C { unit child: U; } }';
    const user = 'swaml "1.0"; package User { import Library::*; import Other::*; system S service { component root: C; } view flow FV of S.root.child.run; }';
    const files = new Map([[libUri.toString(), library], [userUri.toString(), user], [otherUri.toString(), 'swaml "1.0"; package Other {}']]);
    const { shared } = createSwamlServices({ fileSystemProvider: () => new MemoryFiles(files) });
    const docs = await Promise.all([...files.keys()].map(uri => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(uri))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    const userDoc = shared.workspace.LangiumDocuments.getDocument(userUri)!;
    assert.equal(userDoc.diagnostics?.length, 0);
    files.set(libUri.toString(), library.replace('run()', 'renamed()'));
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.code === 'SW080'));
    files.set(libUri.toString(), library);
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.equal(userDoc.diagnostics?.length, 0);
    // The user had no reference into Other. A newly introduced name must still invalidate it.
    files.set(otherUri.toString(), 'swaml "1.0"; package Other { datatype C {} }');
    await shared.workspace.DocumentBuilder.update([otherUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.severity === 1));
    files.set(otherUri.toString(), 'swaml "1.0"; package Other {}');
    await shared.workspace.DocumentBuilder.update([otherUri], []);
    assert.equal(userDoc.diagnostics?.length, 0);
    files.delete(libUri.toString());
    await shared.workspace.DocumentBuilder.update([], [libUri]);
    assert.ok(userDoc.diagnostics?.some(d => d.code === 'SW004'));
});

test('expanded aliases cannot duplicate a subscription', () => invalid(model(`
    interface publishSubscribe I version "1.0.0" { event e(); }
    unit def Sender { port p: I publisher; operation run(): Void { publish p.e(); } }
    unit def Receiver { port p: I subscriber; operation handle(): Void on receive p.e {} }
    component def C {
        port output: I publisher; port input: I subscriber;
        unit producer: Sender; unit consumer: Receiver;
        delegate output -> producer.p; delegate input -> consumer.p;
        connect internal: producer.p -> consumer.p qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
    }
    system S service { component root: C;
        connect external: root.output -> root.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
    }
`), 'SW035'));
test('package/declaration view ambiguity is explicit', () => invalid(model('unit def P {} view v GV of P;'), 'SW080'));
test('an independent reply cannot resolve an ambiguous causal branch', () => invalid(rpc.replace(reply, `${reply} ${request.replace('label sent', 'after sent label second')} ${reply.replace('after sent label answered', 'after second label ambiguous')}`), 'SW083'));

const boundaryModel = (outerOptional = false, nested = false, connected = false) => model(`
    interface publishSubscribe I version "1.0.0" { event e(); }
    unit def Publisher { port p: I publisher; operation run(): Void { publish p.e(); } }
    unit def Subscriber { port p: I subscriber; operation observe(): Void on receive p.e {} }
    component def Source {
        port output: I publisher ${outerOptional && !nested ? 'optional' : ''};
        unit producer: Publisher; unit listener: Subscriber;
        delegate output -> producer.p;
        connect internalEvents: producer.p -> listener.p qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
    }
    ${nested ? `component def Outer { port output: I publisher ${outerOptional ? 'optional' : ''}; component child: Source; delegate output -> child.output; }` : ''}
    component def Sink { port input: I subscriber; unit listener: Subscriber; delegate input -> listener.p; }
    system S service { component root: ${nested ? 'Outer' : 'Source'};
        ${connected ? `component sink: Sink; connect externalEvents: root.output -> sink.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };` : ''}
    }
`);
test('internal leaf use does not connect its required boundary alias', async () => {
    const ds = await diagnostics(boundaryModel());
    assert.deepEqual(ds.map(d => [d.code, d.message]), [['SW034', "Required port 'root.output' is unconnected."]]);
});
test('optional boundary allows an internally connected leaf', async () => assert.deepEqual(await diagnostics(boundaryModel(true)), []));
test('nested unconnected aliases each retain their closure obligation', async () => {
    const ds = await diagnostics(boundaryModel(false, true));
    assert.deepEqual(ds.map(d => [d.code, d.message]), [
        ['SW034', "Required port 'root.output' is unconnected."],
        ['SW034', "Required port 'root.child.output' is unconnected."]
    ]);
});
test('outer connector use propagates through nested aliases to leaves', async () => assert.deepEqual(await diagnostics(boundaryModel(false, true, true)), []));
test('optional outer boundary does not waive a required inner boundary', async () => {
    const ds = await diagnostics(boundaryModel(true, true));
    assert.deepEqual(ds.map(d => [d.code, d.message]), [['SW034', "Required port 'root.child.output' is unconnected."]]);
});
test('distinct boundary routes still enforce single-source leaf receivers', async () => {
    const text = boundaryModel(false, false, true)
        .replace('interface publishSubscribe', 'interface senderReceiver').replace('event e();', 'data e: Int queued;')
        .replaceAll('I publisher', 'I sender').replaceAll('I subscriber', 'I receiver')
        .replace('publish p.e();', 'send p.e(1);').replace('observe():', 'observe(value: Int):')
        .replace('component sink: Sink;', `component sink: Sink; component second: Source;
            connect secondEvents: second.output -> sink.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };`);
    const ds = await diagnostics(text);
    assert.deepEqual(ds.map(d => [d.code, d.message]), [['SW035', "Port 'sink.listener.p' requires a single source/provider."]]);
});
