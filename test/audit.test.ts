import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, EmptyFileSystemProvider, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';

const model = (body: string) => `package P { ${body} }`;
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
test('ambiguity includes declarations of different kinds', () => invalid('package A { datatype T {} } package B { interface senderReceiver T version "1.0.0" { data x: Int queued; } } package C { import A::*; import B::*; datatype Use { value: T; } }'));
test('qualified names disambiguate different declaration kinds', async () => assert.deepEqual(await diagnostics('package A { datatype T {} } package B { interface senderReceiver T version "1.0.0" { data x: Int queued; } } package C { import A::*; import B::*; datatype Use { value: A::T; } }'), []));
for (const index of ['-1', '2', '-(-2)']) test(`constant array bound ${index}`, () => invalid(unit(`var xs: Int[2] = [1, 2]; operation run(): Void { let x: Int = xs[${index}]; }`), 'SW025'));
test('legal array endpoints', async () => assert.deepEqual(await diagnostics(unit('var xs: Int[2] = [1, 2]; operation run(): Void { let a: Int = xs[0]; let b: Int = xs[1]; }')), []));
test('failure binding cannot overwrite user data', () => invalid(rpc.replace('var healthy:', 'var failure: String = ""; var healthy:'), 'SW002'));
test('Void request completion cannot be used as a value', () => invalid(rpc.replace('check(): Bool', 'check(): Void').replace('checkHealth(): Bool', 'checkHealth(): Void').replace('return true;', 'return;'), 'SW022'));
test('Void request completion may be discarded', async () => assert.deepEqual(await diagnostics(rpc.replace('check(): Bool', 'check(): Void').replace('checkHealth(): Bool', 'checkHealth(): Void').replace('return true;', 'return;').replace('healthy = statusValue;', '')), []));
test('Void cannot be returned as an expression', () => invalid(unit('operation run(): Void { return true; }'), 'SW023'));
test('function parameters do not shadow private state', () => invalid(unit('var x: Int = 0; function f(x: Int): Int = x;'), 'SW002'));
const reentrant = 'operation run(): Void on manual timing { wcet 1 ms; deadline 5 ms; concurrency reentrant; } { invoke helper(); }';
test('reentrant transitive writes rejected', () => invalid(unit(`var x: Int = 0; ${reentrant} operation helper(): Void { invoke mutate(); } operation mutate(): Void { x = 1; }`), 'SW054'));
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
test('package and instance view subjects', async () => assert.deepEqual(await diagnostics(model('unit def U { operation run(): Void {} } component def C { unit child: U; } component S service { component root: C; } view pkg GV of P; view grid GRV of P; view wiring IV of S.root; view flow FV of S.root.child.run;')), []));
test('required boundary alias cannot be weakened by optional leaf', () => invalid(model('interface publishSubscribe I version "1.0.0" { event e(); } unit def U { port p: I publisher optional; operation run(): Void { publish p.e(); } } component def C { port p: I publisher; unit child: U; delegate p -> child.p; } component S service { component root: C; }'), 'SW034'));
test('unsafe transition priority rejected', () => invalid(fixture('04-stateful-operation').replace('on receive commands.begin', 'on receive commands.begin priority 9007199254740992'), 'SW062'));

class MemoryFiles extends EmptyFileSystemProvider {
    constructor(readonly files: Map<string, string>) { super(); }
    override async readFile(uri?: URI) { return this.files.get(uri!.toString())!; }
    override async stat(uri: URI) { return { uri, isFile: true, isDirectory: false }; }
}
test('editor updates revalidate negative lookups, paths and deletion across files', async () => {
    const libUri = URI.parse('file:///library.swaml'), userUri = URI.parse('file:///user.swaml'), otherUri = URI.parse('file:///other.swaml');
    const library = 'package Library { unit def U { operation run(): Void {} } component def C { unit child: U; } }';
    const user = 'package User { import Library::*; import Other::*; component S service { component root: C; } view flow FV of S.root.child.run; }';
    const files = new Map([[libUri.toString(), library], [userUri.toString(), user], [otherUri.toString(), 'package Other {}']]);
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
    files.set(otherUri.toString(), 'package Other { datatype C {} }');
    await shared.workspace.DocumentBuilder.update([otherUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.severity === 1));
    files.set(otherUri.toString(), 'package Other {}');
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
    component S service { component root: C;
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
    component S service { component root: ${nested ? 'Outer' : 'Source'};
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

// Version 1.1 reduces authoring syntax without weakening type/occurrence boundaries.
for (const word of ['swaml', 'system', 'machine', 'set', 'compute', 'enumValue', 'array']) {
    test(`removed keyword ${word} is an ordinary identifier`, async () => assert.deepEqual(await diagnostics(model(`
        unit def ${word} { var ${word}: Int = 0; operation run() { ${word} = ${word} + 1; } }
        component example { unit instance: ${word}; }
    `)), []));
}
for (const [name, text] of [
    ['header', 'swaml "1.1"; package P {}'],
    ['system wrapper', model('system Example service {}')],
    ['machine wrapper', unit('operation run() on start machine { initial Idle; state Idle {} }')],
    ['set prefix', unit('var n: Int = 0; operation run() { set n = 1; }')],
    ['compute prefix', unit('function f(): Int = 1; operation run() { let n: Int = compute f(); }')],
    ['array prefix', unit('var n: Int[1] = array [1];')],
    ['enumValue prefix', model('enum E { V } unit def U { var e: E = enumValue E.V; }')]
]) test(`1.1 rejects obsolete ${name}`, () => invalid(text));
test('direct root unit and omitted service profile are supported', async () => assert.deepEqual(await diagnostics(model('unit def U { operation run() on start {} } component Example { unit child: U; }')), []));
test('typed root resolves definition topology, cases and view paths', async () => assert.deepEqual(await diagnostics(model(`
    interface clientServer I version "1.0.0" { operation ping(); }
    unit def Client { port p: I client; operation run() on start { request p.ping() as done within 1 s otherwise { return; }; } }
    unit def Server { port p: I server; operation ping() on call p.ping {} }
    component def Assembly { unit caller: Client; unit serviceUnit: Server;
        connect rpc: caller.p -> serviceUnit.p qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
    }
    component Example: Assembly;
    case Ping for Example {
        request caller.p.ping -> serviceUnit.p.ping via rpc label sent;
        reply serviceUnit.p.ping -> caller.p.ping via rpc after sent label received;
    }
    view wiring IV of Example;
    view behavior FV of Example.caller.run;
    view scenario CV of Example;
    view sequence SV of Ping;
`)), []));
test('typed root deployment binds definition-relative instance paths', async () => assert.deepEqual(await diagnostics(model(`
    unit def U { operation run() on start timing { wcet 1 ms; deadline 2 ms; concurrency serial; } {} }
    component def C { unit child: U; }
    component Example: C realtime { node cpu mcu; deploy child on cpu; }
`)), []));
test('typed roots preserve realtime timing obligations', () => invalid(model('unit def U { operation run() on start {} } component def C { unit child: U; } component Example: C realtime;'), 'SW045'));
test('inline direct units preserve realtime timing obligations', () => invalid(model('unit def U { operation run() on start {} } component Example realtime { unit child: U; }'), 'SW045'));
test('typed root cannot extend topology', () => invalid(model('unit def U {} component def C {} component Example: C { unit child: U; }'), 'SW012'));
test('typed root cannot add a connector', () => invalid(model('component def C {} component Example: C { connect extra: a.p -> b.p; }'), 'SW012'));
test('root binding names cannot collide with definition members', () => invalid(model('unit def U {} component def C { unit cpu: U; } component Example: C { node cpu process; }'), 'SW002'));
test('typed root must reference a component definition', () => invalid(model('unit def U {} component Example: U;')));
test('root occurrences cannot be reused as types', () => invalid(model('component Example {} component def C { component reused: Example; }')));
test('component type still requires def', () => invalid(model('component Reusable {} component Example: Reusable;')));
test('inline root requires a body', () => invalid(model('component Example;')));
test('deployment cannot capture another root node', () => invalid(model('unit def U {} component def C { unit child: U; } component First: C { node cpu process; } component Second: C { deploy child on cpu; }')));
test('typed root retains required root boundary closure', () => invalid(model(`
    interface publishSubscribe I version "1.0.0" { event e(); }
    unit def U { port p: I publisher; operation emit() { publish p.e(); } }
    component def C { port boundary: I publisher; unit child: U; delegate boundary -> child.p; }
    component Example: C;
`), 'SW034'));
test('omitted operation result is Void and cannot return a value', () => invalid(unit('operation run() { return 1; }'), 'SW023'));
test('omitted operation result supports local invoke', async () => assert.deepEqual(await diagnostics(unit('operation run() on start { invoke helper(); } operation helper() { return; }')), []));
test('functions still require explicit result types', () => invalid(unit('function f() = 1;')));
test('state body belongs directly to the operation', async () => assert.deepEqual(await diagnostics(unit('operation run() on start { initial Idle; state Idle {} }')), []));
test('state body cannot mix statement flow with states', () => invalid(unit('operation run() on start { initial Idle; state Idle {} return; }')));
test('state body requires initial first', () => invalid(unit('operation run() on start { state Idle {} initial Idle; }')));
test('state references cannot escape their owning operation', () => invalid(unit('operation first() on start { initial Idle; state Idle {} } operation second() on start { initial Idle; state Other {} }')));

test('enum literals and record field values have deterministic lexical resolution', async () => assert.deepEqual(await diagnostics(model(`
    enum Status { Ready }
    datatype Data { Ready: Int; }
    unit def U {
        operation run() {
            let Status: Data = record Data { Ready = 1; };
            let count: Int = Status.Ready;
            let stateValue: P::Status = P::Status.Ready;
        }
    }
`)), []));
test('a local name prevents enum fallback even when its field is missing', () => invalid(model('enum Status { Ready } unit def U { operation run() { let Status: Int = 1; let stateValue: P::Status = Status.Ready; } }'), 'SW022'));
test('inaccessible unit values do not shadow enums in pure expression environments', async () => assert.deepEqual(await diagnostics(model(`
    enum Status { Ready }
    unit def U {
        var Status: Int = 1;
        var value: Status = Status.Ready;
        function ready(): Status = Status.Ready;
        operation check() { assert value == ready(); assert value == P::Status.Ready; }
    }
`)), []));
test('unqualified enums require a visible package', () => invalid('package A { enum E { V } } package B { unit def U { operation run() { assert E.V == E.V; } } }', 'SW022'));
test('qualified enum expressions resolve without an import', async () => assert.deepEqual(await diagnostics('package A { enum E { V } } package B { unit def U { operation run() { assert A::E.V == A::E.V; } } }'), []));
test('imported enum expressions resolve nominally', async () => assert.deepEqual(await diagnostics('package A { enum E { V } } package B { import A::*; unit def U { var value: E = E.V; } }'), []));
test('ambiguous imported enum types are rejected', () => invalid('package A { enum E { V } } package B { enum E { V } } package C { import A::*; import B::*; unit def U { operation run() { assert E.V == E.V; } } }', 'SW022'));
test('enum name ambiguity includes other declaration kinds', () => invalid('package A { enum E { V } } package B { datatype E { V: Int; } } package C { import A::*; import B::*; unit def U { operation run() { assert E.V == E.V; } } }', 'SW022'));
test('same-shaped enums retain distinct nominal identities', () => invalid('package A { enum E { V } } package B { enum E { V } unit def U { var value: E = A::E.V; } }', 'SW023'));
test('enum literals cannot be indexed', () => invalid(model('enum E { V } unit def U { operation run() { assert E.V[0] == E.V; } }'), 'SW023'));
test('direct function call stays scoped to its own unit', () => invalid(model('unit def A { function hidden(): Int = 1; } unit def B { operation run() { let n: Int = hidden(); } }')));
test('new assignment syntax cannot address another unit', () => invalid(unit('operation run() { other.value = 1; }')));
test('enum-only cross-file paths revalidate on update and deletion', async () => {
    const libUri = URI.parse('file:///enum-library.swaml'), userUri = URI.parse('file:///enum-user.swaml');
    const lib = 'package Library { enum State { Ready } }';
    const files = new Map([[libUri.toString(), lib], [userUri.toString(), 'package User { unit def U { operation run() { assert Library::State.Ready == Library::State.Ready; } } }']]);
    const { shared } = createSwamlServices({ fileSystemProvider: () => new MemoryFiles(files) });
    const docs = await Promise.all([...files.keys()].map(uri => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(uri))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    const userDoc = shared.workspace.LangiumDocuments.getDocument(userUri)!;
    assert.equal(userDoc.diagnostics?.length, 0);
    files.set(libUri.toString(), lib.replace('Ready', 'Stopped'));
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.ok(userDoc.diagnostics?.some(d => d.code === 'SW027'));
    files.set(libUri.toString(), lib);
    await shared.workspace.DocumentBuilder.update([libUri], []);
    assert.equal(userDoc.diagnostics?.length, 0);
    files.delete(libUri.toString());
    await shared.workspace.DocumentBuilder.update([], [libUri]);
    assert.ok(userDoc.diagnostics?.some(d => d.code === 'SW022'));
});

test('imported root timing obligations report valid selecting-document locations', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem), parse = parseHelper<Model>(Swaml);
    const library = await parse(`package Library {
        interface senderReceiver I version "1.0.0" { data sample: Int queued; }
        unit def Producer {
            port output: I sender;
            operation run() on start { send output.sample(1); }
        }
        unit def Consumer {
            port input: I receiver;
            operation handle(value: Int) on receive input.sample {}
        }
        component def C {
            unit source: Producer; unit sink: Consumer;
            connect stream: source.output -> sink.input qos { delivery atMostOnce; ordering fifo; capacity 1; overflow reject; };
        }
    }`, { documentUri: 'file:///timing-library.swaml' });
    const application = await parse('package Application { component demo: Library::C realtime; }', { documentUri: 'file:///timing-application.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    assert.deepEqual(library.diagnostics, []);
    const ds = application.diagnostics ?? [];
    assert.equal(ds.length, 3);
    assert.ok(ds.every(d => ['SW044', 'SW045'].includes(String(d.code)) && d.range.start.line === 0 && d.range.end.line === 0));
    assert.ok(ds.some(d => String(d.message).includes('Library::C.stream')));
    assert.ok(ds.some(d => String(d.message).includes('Library::Producer.run')));
    assert.ok(ds.some(d => String(d.message).includes('Library::Consumer.handle')));
});
