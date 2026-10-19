import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AstUtils, EmptyFileSystem, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, SWAML_LANGUAGE_VERSION } from '../src/language/swaml-module.js';
import * as a from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';

async function parse(source: string) {
    const services = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<a.Model>(services.Swaml)(source, { validation: true });
    assert.ok(!document.diagnostics?.some(d => /error occurred during validation/i.test(String(d.message))), JSON.stringify(document.diagnostics));
    return { ...services, document };
}
const model = (members: string) => `package P { component Demo { ${members} } }`;
async function run(source: string, root = 'P::Demo', options: SimulationOptions = { untilNs: 1000000 }) {
    const { document } = await parse(source);
    assert.deepEqual(document.diagnostics, [], JSON.stringify(document.diagnostics));
    return simulate([document.parseResult.value], root, options);
}
async function invalid(source: string, code?: string) {
    const { document } = await parse(source);
    assert.ok(document.diagnostics?.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(document.diagnostics));
}

test('completion chains release distinct serial activations after successful operation/function completion', async () => {
    const r = await run(model(`var stage: int = 0;
        operation first() on start { stage = 1; }
        function second() on completion first { assert stage == 1; stage = 2; }
        operation third() on completion second { assert stage == 2; stage = 3; }`));
    assert.equal(SWAML_LANGUAGE_VERSION, '1.4');
    assert.equal(r.profile, 'swaml-reference/1.4');
    assert.equal(r.outcome, 'no-failure-observed');
    assert.equal(r.stores[''].stage, 3);
    const releases = r.trace.filter(t => t.kind === 'release');
    assert.deepEqual(releases.map(t => t.function), ['first', 'second', 'third']);
    assert.equal(new Set(releases.map(t => t.subject)).size, 3);
    for (const release of releases.slice(1)) {
        const complete = r.trace.find(t => t.kind === 'complete' && t.subject === release.predecessorActivation)!;
        const dispatch = r.trace.find(t => t.kind === 'dispatch' && t.subject === release.subject)!;
        assert.equal(release.cause, 'completion');
        assert.equal(release.predecessorFunction, complete.function);
        assert.equal(complete.functionComplete, true);
        assert.ok(complete.ordinal < release.ordinal && release.ordinal < dispatch.ordinal);
    }
});

test('completion references retain source spelling and target identity through AST JSON serialization', async () => {
    const { document, Swaml } = await parse(model('function first() on start {} function second() on completion first {}'));
    assert.deepEqual(document.diagnostics, []);
    const serialized = Swaml.serializer.JsonSerializer.serialize(document.parseResult.value, { refText: true });
    const restored = Swaml.serializer.JsonSerializer.deserialize<a.Model>(serialized);
    const functions = [...AstUtils.streamAllContents(restored)].filter(a.isFunctionDef);
    assert.equal(functions[1].trigger?.kind, 'completion');
    assert.equal(functions[1].trigger?.predecessor?.$refText, 'first');
    assert.equal(functions[1].trigger?.predecessor?.ref, functions[0]);
});

test('successful periodic occurrences release once each without coalescing', async () => {
    const r = await run(model(`var starts: int = 0; var completions: int = 0;
        function first() on every 1 ns { starts = starts + 1; }
        function second() on completion first { completions = completions + 1; }`), 'P::Demo', { untilNs: 3 });
    assert.equal(r.stores[''].starts, 3); assert.equal(r.stores[''].completions, 3);
    const causes = r.trace.filter(t => t.kind === 'release' && t.cause === 'completion');
    assert.equal(causes.length, 3); assert.equal(new Set(causes.map(t => t.predecessorActivation)).size, 3);
});

test('source failure preserves committed effects but releases no completion target', async () => {
    const r = await run(model(`var stage: int = 0; function first() on start { stage = 1; fail "stop"; }
        function second() on completion first { stage = 2; }`));
    assert.equal(r.stores[''].stage, 1); assert.equal(r.outcome, 'failed');
    assert.equal(r.trace.filter(t => t.kind === 'release' && t.function === 'second').length, 0);
});

test('dependent failure does not change the successful predecessor or release its successor', async () => {
    const r = await run(model(`var stage: int = 0; function first() on start { stage = 1; }
        function second() on completion first { stage = 2; fail "dependent"; }
        function third() on completion second { stage = 3; }`));
    assert.equal(r.stores[''].stage, 2);
    assert.ok(r.trace.some(t => t.kind === 'complete' && t.function === 'first' && t.functionComplete));
    assert.ok(!r.trace.some(t => t.kind === 'failure' && t.function === 'first'));
    assert.ok(!r.trace.some(t => t.kind === 'release' && t.function === 'third'));
});

test('local helper returns do not emit root completion or start dependents early', async () => {
    const r = await run(model(`var stage: int = 0; function helper() { stage = 1; }
        function first() on start { call helper(); assert stage == 1; stage = 2; }
        function second() on completion first { assert stage == 2; stage = 3; }`));
    assert.equal(r.stores[''].stage, 3);
    assert.equal(r.trace.filter(t => t.kind === 'release' && t.cause === 'completion').length, 1);
});

test('a newly released activation captures its own dispatch snapshot', async () => {
    const r = await run(model(`var value: int = 0;
        function first() on start timing { wcet 1 ms; deadline 2 ms; concurrency reentrant; } { assert value == 0; assert value == 0; }
        function change() on start { value = 5; }
        function second() on completion first timing { wcet 1 ms; deadline 2 ms; concurrency reentrant; } { assert value == 5; }`));
    assert.equal(r.outcome, 'no-failure-observed');
    assert.ok(r.trace.some(t => t.kind === 'complete' && t.function === 'second'));
});

const machine = (entry = 'stage = 2;') => model(`var stage: int = 0;
    function first() on start { initial Waiting; state Waiting { entry { stage = 1; } }
        state Done final { entry { ${entry} } } transition finish: Waiting -> Done on after 10 ms {} }
    function second() on completion first { assert stage == 2; stage = 3; }`);
test('state reaction completion does not release a machine dependent before final entry finishes', async () => {
    const early = await run(machine(), 'P::Demo', { untilNs: 5000000 });
    assert.equal(early.stores[''].stage, 1);
    assert.ok(!early.trace.some(t => t.kind === 'release' && t.cause === 'completion'));
    const ended = await run(machine(), 'P::Demo', { untilNs: 20000000 });
    assert.equal(ended.stores[''].stage, 3);
    assert.equal(ended.trace.filter(t => t.kind === 'release' && t.cause === 'completion').length, 1);
});
test('failed final entry terminates a machine without successful completion release', async () => {
    const r = await run(machine('fail "final entry";'), 'P::Demo', { untilNs: 20000000 });
    assert.equal(r.stores[''].stage, 1); assert.equal(r.outcome, 'failed');
    assert.ok(!r.trace.some(t => t.kind === 'release' && t.cause === 'completion'));
});
test('a bare state return completes its owning machine once', async () => {
    const r = await run(model(`var count: int = 0;
        function first() on start { initial Waiting; state Waiting { entry { return; } } }
        function second() on completion first { count = count + 1; }`));
    assert.equal(r.stores[''].count, 1);
    assert.equal(r.machines.first.live, false);
});

test('effective inherited predecessors remain local to each distinct occurrence', async () => {
    const r = await run(`package P {
        component def Base { var value: int = 0; operation first() on start { value = 1; }
            function second() on completion first { value = value + 10; } }
        component def Derived specializes Base { redefines function first() on start { value = 2; } }
        component Demo { component left: Base; component right: Derived; } }`);
    assert.equal(r.stores.left.value, 11); assert.equal(r.stores.right.value, 12);
    assert.deepEqual(r.trace.filter(t => t.kind === 'release' && t.cause === 'completion').map(t => [t.function, t.predecessorFunction]),
        [['left.second', 'left.first'], ['right.second', 'right.first']]);
});

test('cross-file inherited completion references preserve validated workspace dependencies', async () => {
    const { shared } = createSwamlServices(EmptyFileSystem);
    const base = shared.workspace.LangiumDocumentFactory.fromString<a.Model>(`package Library {
        component def Base { var stage: int = 0; function first() on start { stage = 1; }
            function second() on completion first { stage = 2; } } }`, URI.parse('memory:///library.swaml'));
    const usage = shared.workspace.LangiumDocumentFactory.fromString<a.Model>(`package P { import Library::*;
        component Demo: Base; }`, URI.parse('memory:///usage.swaml'));
    for (const document of [base, usage]) shared.workspace.LangiumDocuments.addDocument(document);
    await shared.workspace.DocumentBuilder.build([base, usage], { validation: true });
    assert.deepEqual([...(base.diagnostics ?? []), ...(usage.diagnostics ?? [])], []);
    const r = simulate([base.parseResult.value, usage.parseResult.value], 'P::Demo', { untilNs: 1 });
    assert.equal(r.stores[''].stage, 2);
    assert.throws(() => simulate([usage.parseResult.value], 'P::Demo', { untilNs: 1 }), /referenced document/);
});

test('fanout releases separate roots and atomically rejects a bounded-backlog overflow', async () => {
    const source = model(`function first() on start {} function second() on completion first {}
        function third() on completion first {} function fourth() on completion first {}`);
    const r = await run(source);
    assert.equal(r.trace.filter(t => t.kind === 'release' && t.cause === 'completion').length, 3);
    const limited = await run(source, 'P::Demo', { untilNs: 1, maxPending: 2 });
    assert.equal(limited.status, 'violation');
    assert.ok(limited.trace.some(t => t.kind === 'violation' && t.code === 'ActivationOverflow'));
    assert.ok(!limited.trace.some(t => t.kind === 'release' && t.cause === 'completion'));
});

test('successful RPC handler completion releases its local dependent even when the remote caller times out', async () => {
    const r = await run(`package P {
        interface clientServer Api version "1.0.0" { function compute(input: int): int; }
        component def Provider { port api: Api server; var count: int = 0;
            function compute(input: int): int on call api.compute { return input + 1; }
            function finished() on completion compute { count = count + 1; } }
        component def Client { port api: Api client;
            function run() on start { call api.compute(3) as value within 1 ns otherwise { fail "timeout"; }; } }
        component Demo { component caller: Client; component provider: Provider;
            connect route: caller.api -> provider.api qos { delivery atMostOnce; ordering fifo; capacity 4; overflow reject; }; } }`,
        'P::Demo', { untilNs: 10, latencyNs: 1 });
    assert.equal(r.stores.provider.count, 1);
    assert.ok(r.trace.some(t => t.kind === 'requestComplete' && t.failure === 'Timeout'));
    assert.ok(r.trace.some(t => t.kind === 'release' && t.function === 'provider.finished' && t.predecessorFunction === 'provider.compute'));
});

for (const [label, members, code] of [
    ['parameterized target', 'function first() on start {} function second(x: int) on completion first {}', 'SW066'],
    ['nonvoid target', 'function first() on start {} function second(): int on completion first { return 1; }', 'SW066'],
    ['stateful target', 'function first() on start {} function second() on completion first { initial Done; state Done final {} }', 'SW066'],
    ['helper source', 'function first() {} function second() on completion first {}', 'SW066'],
    ['self dependency', 'function first() on completion first {}', 'SW067'],
    ['dependency cycle', 'function first() on completion second {} function second() on completion first {}', 'SW067'],
    ['local call of dependent', 'function first() on start { call second(); } function second() on completion first {}', 'SW058'],
    ['missing source', 'function second() on completion missing {}', undefined],
    ['qualified source', 'function first() on start {} function second() on completion P::Demo::first {}', undefined],
    ['missing predecessor recovery', 'function first() on completion {}', undefined],
] as const) test(`rejects ${label}`, () => invalid(model(members), code));

test('another component or package never supplies a completion predecessor', () => invalid(`package P {
    component def Other { function first() on start {} }
    component Demo { component other: Other; function second() on completion first {} } }`));
test('redefinition must preserve the completion predecessor contract', () => invalid(`package P {
    component def Base { function first() on start {} function other() on start {} function second() on completion first {} }
    component def Derived specializes Base { redefines function second() on completion other {} } }`, 'SW014'));
test('effective inherited cycles cannot pass through a changed predecessor trigger', () => invalid(`package P {
    component def Base { function first() on start {} function second() on completion first {} }
    component def Derived specializes Base { redefines function first() on completion second {} } }`, 'SW067'));
