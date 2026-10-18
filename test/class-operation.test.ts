import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, selectView, viewCandidates } from '../src/language/swaml-module.js';
import * as a from '../src/language/generated/ast.js';
import { simulate } from '../src/simulation/simulator.js';

async function parse(body: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<a.Model>(Swaml)(`package P { ${body} }`, { validation: true });
    assert.ok(!document.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(document.diagnostics));
    return document;
}
async function valid(body: string) {
    const document = await parse(body);
    assert.deepEqual(document.diagnostics, []);
    return document;
}
async function invalid(body: string, code?: string) {
    const document = await parse(body);
    assert.ok(document.diagnostics?.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(document.diagnostics));
    return document;
}

test('authored structural and executable categories retain the existing portable AST rule identities', async () => {
    const document = await valid(`
        interface service Api version "1.0.0" { operation read(): int; function check(): bool; }
        class def General { operation work() {} function helper() {} }
        component def Specialized specializes General {}
        class GeneralRoot: General;
        component SpecializedRoot: Specialized;
        class Inline {
            class general: General;
            component specialized: Specialized;
            operation boot() on start {}
            function helper() {}
        }
    `);
    const elements = document.parseResult.value.packages[0].elements;
    assert.deepEqual(elements.filter(a.isComponent).map(n => [n.$type, n.kind, n.name]), [
        ['Component', 'class', 'General'], ['Component', 'component', 'Specialized']
    ]);
    assert.deepEqual(elements.filter(a.isRootComponent).map(n => [n.$type, n.kind, n.name]), [
        ['RootComponent', 'class', 'GeneralRoot'], ['RootComponent', 'component', 'SpecializedRoot'], ['RootComponent', 'class', 'Inline']
    ]);
    const root = elements.find((n): n is a.RootComponent => a.isRootComponent(n) && n.name === 'Inline')!;
    assert.deepEqual(root.members.filter(a.isInstance).map(n => [n.$type, n.kind]), [['Instance', 'class'], ['Instance', 'component']]);
    assert.deepEqual(root.members.filter(a.isFunctionDef).map(n => [n.$type, n.kind]), [['FunctionDef', 'operation'], ['FunctionDef', 'function']]);
    assert.deepEqual(elements.find(a.isInterface)!.members.filter(a.isSignature).map(n => [n.$type, n.kind]), [['Signature', 'operation'], ['Signature', 'function']]);
});

for (const [derived, base, allowed] of [
    ['class', 'class', true], ['component', 'class', true], ['component', 'component', true], ['class', 'component', false]
] as const) test(`${derived} specialization of ${base} ${allowed ? 'is permitted' : 'is rejected as widening'}`, async () => {
    const source = `${base} def Base {} ${derived} def Derived specializes Base {}`;
    if (allowed) await valid(source); else await invalid(source, 'SW016');
});

for (const location of ['root', 'child'] as const) for (const usage of ['class', 'component'] as const) for (const definition of ['class', 'component'] as const) {
    const allowed = usage === 'class' || definition === 'component';
    test(`${usage} ${location} usage of ${definition} definition ${allowed ? 'is permitted' : 'requires a component definition'}`, async () => {
        const declaration = `${usage} occurrence: Definition;`;
        const source = `${definition} def Definition {} ${location === 'root' ? declaration : `class def Owner { ${declaration} } class Root: Owner;`}`;
        if (allowed) await valid(source); else await invalid(source, 'SW016');
    });
}

test('class roots preserve deployment bindings, root contexts and all structural/case views', async () => {
    const document = await valid(`
        class def Child {}
        class def Assembly { class child: Child; }
        class Root: Assembly service {
            deploy Root on "system:host";
            deploy child on "sysml:Vehicle::ecu";
        }
        useCase Intent of Root {}
        verificationCase Check of Root {}
        view structure gv of Root;
        view links iv of Root.child;
        view cases cv of Root;
        view sequence sv of Intent;
        view properties grv of Root.child;
    `);
    const pkg = document.parseResult.value.packages[0];
    assert.ok(pkg.elements.filter(a.isScenario).every(c => c.root.ref?.kind === 'class'));
    assert.deepEqual(pkg.elements.filter(a.isView).map(v => selectView(v).map(s => s.path)), [['Root'], ['Root.child'], ['Root'], ['Intent'], ['Root.child']]);
});

test('a typed class root cannot extend topology and class roots retain port closure', async () => {
    await invalid('class def Base {} class Root: Base { operation extra() {} }', 'SW012');
    await invalid(`interface publishSubscribe Events version "1.0.0" { event tick(); }
        class Root { port input: Events subscriber; operation receiveTick() on receive input.tick {} }`, 'SW034');
});

test('class specialization and containment retain acyclic constraints', async () => {
    await invalid('class def First specializes Second {} class def Second specializes First {}', 'SW015');
    await invalid('class def First { class child: Second; } component def Second specializes First {}', 'SW013');
});

for (const [base, replacement, allowed] of [
    ['operation', 'operation', true], ['operation', 'function', true], ['function', 'function', true], ['function', 'operation', false]
] as const) test(`${base} member redefinition by ${replacement} ${allowed ? 'preserves or narrows' : 'cannot widen'} the executable category`, async () => {
    const source = `class def Base { ${base} work(value: int): int { return value; } }
        component def Derived specializes Base { redefines ${replacement} work(value: int): int { return value + 1; } }`;
    if (allowed) await valid(source); else await invalid(source, 'SW014');
});

for (const replacement of [
    'redefines function work(other: int): int { return other; }',
    'redefines function work(value: real): int { return 1; }',
    'redefines function work(value: int): real { return 1.0; }',
    'redefines function work(value: int): int on start { return value; }'
]) test(`operation narrowing still preserves its signature and trigger: ${replacement}`, async () => { await invalid(`
    class def Base { operation work(value: int): int { return value; } }
    component def Derived specializes Base { ${replacement} }
`, 'SW014'); });

test('operation narrowing preserves timing and statement/state body contracts', async () => {
    await invalid(`class def Base { operation work() on start timing { wcet 1 ns; deadline 2 ns; concurrency serial; } {} }
        component def Derived specializes Base { redefines function work() on start timing { wcet 2 ns; deadline 2 ns; concurrency serial; } {} }`, 'SW014');
    await invalid(`class def Base { operation work() on start {} }
        component def Derived specializes Base { redefines function work() on start { initial Ready; state Ready final {} } }`, 'SW014');
});

test('class child redefinition may narrow to a compatible component occurrence', async () => { await valid(`
    class def Child {}
    class def Better specializes Child {}
    component def Specific specializes Child {}
    class def Base { class child: Child; }
    class def GeneralReplacement specializes Base { redefines class child: Better; }
    component def NarrowReplacement specializes Base { redefines component child: Specific; }
    class def ComponentAsClass { class child: Specific; }
    component def NarrowUsage specializes ComponentAsClass { redefines component child: Specific; }
    component def ComponentBase { component child: Specific; }
    component def ComponentReplacement specializes ComponentBase { redefines component child: Specific; }
`); });

test('child category narrowing cannot widen a component or substitute an unrelated definition', async () => {
    await invalid(`component def Child {} component def Base { component child: Child; }
        component def Derived specializes Base { redefines class child: Child; }`, 'SW014');
    await invalid(`class def Child {} component def Other {} class def Base { class child: Child; }
        component def Derived specializes Base { redefines component child: Other; }`, 'SW014');
    await invalid(`class def Child {} class def Base { class child: Child; }
        component def Derived specializes Base { redefines component child: Child; }`, 'SW016');
});

for (const signature of ['operation', 'function'] as const) for (const handler of ['operation', 'function'] as const) for (const kind of ['clientServer', 'service'] as const) {
    const allowed = signature === 'operation' || handler === 'function';
    test(`${kind} ${signature} signature ${allowed ? 'accepts' : 'rejects widening to'} a ${handler} handler`, async () => {
        const source = `interface ${kind} Api version "1.0.0" { ${signature} work(input: int): int; }
            class def Server { port api: Api ${kind === 'service' ? 'provides' : 'server'};
                ${handler} execute(value: int): int on call api.work { return value; } }`;
        if (allowed) await valid(source); else await invalid(source, 'SW052');
    });
}

test('operations retain calculation purity, local-only calls and private data boundaries', async () => {
    await invalid('class Root { var secret: int = 1; operation work() { calc value { return result: int = secret; } } }', 'SW022');
    await invalid('class def Child { operation hidden() {} } class Root { class child: Child; operation work() { call hidden(); } }');
    await invalid('class def Child { var secret: int = 1; } class Root { class child: Child; operation work() { assert child.secret == 1; } }', 'SW022');
    await invalid('class Root { operation first() { call second(); } function second() { call first(); } }', 'SW056');
    await invalid('class Root { operation boot() on start {} function run() { call boot(); } }', 'SW058');
    await invalid('class Root { var count: int = 0; operation boot() on start timing { wcet 1 ns; deadline 2 ns; concurrency reentrant; } { count = 1; } }', 'SW054');
    await invalid('class def Value {} class Root { var object: Value = 1; }');
});

test('operations and functions are executable FV/TV subjects while interface signatures remain contracts', async () => {
    const document = await valid(`
        interface service Api version "1.0.0" { operation work(); function check(); }
        class Root {
            operation work() { calc twice { in value: int; return result: int = value * 2; } assert twice(2) == 4; }
            function helper() {}
            operation lifecycle() on start { initial Ready; state Ready final {} }
        }
        view flow fv of Root.work;
        view states fv of Root.lifecycle;
        view timeline tv { include Root.work; include Root.helper; include Root.lifecycle; }
    `);
    const views = document.parseResult.value.packages[0].elements.filter(a.isView);
    assert.deepEqual(views.map(v => selectView(v).map(s => s.path)), [['Root.work'], ['Root.lifecycle'], ['Root.work', 'Root.helper', 'Root.lifecycle']]);
    await invalid('interface service Api version "1.0.0" { operation work(); } view bad tv of Api.work;', 'SW080');
    await invalid('class Root { operation work() {} } view bad fv of Root;', 'SW080');
    await invalid('class Root { operation work() { calc value { return result: int = 1; } } } view bad tv of Root.work.value;', 'SW080');
});

test('view kind filters use exact authored categories without implicit subtype comparisons', async () => {
    const document = await valid(`
        class def General { operation work() {} function helper() {} }
        component def Specific specializes General {}
        class Root { class general: General; component specific: Specific; }
        view classes gv { include Root recursive where kind == "class"; }
        view components gv { include Root recursive where kind == "component"; }
        view operations fv { include Root recursive where kind == "operation"; }
        view functions tv { include Root recursive where kind == "function"; }
        view allBehavior tv { include Root recursive where kind == "operation" or kind == "function"; }
    `);
    const pkg = document.parseResult.value.packages[0];
    assert.deepEqual(pkg.elements.filter(a.isView).map(v => selectView(v).map(s => s.path)), [
        ['Root', 'Root.general'], ['Root.specific'], ['Root.general.work', 'Root.specific.work'],
        ['Root.general.helper', 'Root.specific.helper'], ['Root.general.work', 'Root.general.helper', 'Root.specific.work', 'Root.specific.helper']
    ]);
    assert.deepEqual(viewCandidates(pkg).filter(c => ['General', 'Specific', 'General.work', 'General.helper'].includes(c.path)).map(c => [c.path, c.kind]), [
        ['General', 'class'], ['General.work', 'operation'], ['General.helper', 'function'], ['Specific', 'component']
    ]);
});

test('imported class definitions and operation contracts preserve category checks across documents', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const parseDocument = parseHelper<a.Model>(Swaml);
    const library = await parseDocument(`package Library {
        class def Base { operation value(): int { return 3; } }
        component def Specific specializes Base {}
        interface service Api version "1.0.0" { operation read(): int; }
    }`, { validation: true, documentUri: 'file:///class-operation-library.swaml' });
    assert.deepEqual(library.diagnostics, []);
    const client = await parseDocument(`package Client {
        import Library::*;
        component def Local specializes Base { redefines function value(): int { return 4; } }
        class Root { class imported: Library::Specific; component narrowed: Local; }
        class def Server { port api: Api provides; function read(): int on call api.read { return 1; } }
        useCase Intent of Root {}
    }`, { validation: true, documentUri: 'file:///class-operation-client.swaml' });
    assert.deepEqual(client.diagnostics, []);
    const wrong = await parseDocument('package Wrong { import Library::*; component Root: Base; class def Invalid specializes Specific {} }', { validation: true, documentUri: 'file:///class-operation-wrong.swaml' });
    assert.equal(wrong.diagnostics?.filter(d => d.code === 'SW016').length, 2);
});

test('class and component occurrences execute inherited operations with independent stores', async () => {
    const document = await valid(`
        class def Base {
            var count: int = 0;
            operation step(): int { return 1; }
            operation run() on start { call step() as amount; count = count + amount; }
        }
        component def Specific specializes Base { redefines function step(): int { return 5; } }
        class Root {
            class first: Specific;
            component second: Specific;
            class general: Base;
            var own: int = 0;
            operation boot() on start { calc twice { in x: int; return result: int = x * 2; } own = twice(3); }
        }
    `);
    const result = simulate([document.parseResult.value], 'P::Root', { untilNs: 100 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual([result.stores.first.count, result.stores.second.count, result.stores.general.count, result.stores[''].own], [5, 5, 1, 6]);
    assert.ok(result.trace.some(e => e.kind === 'dispatch' && e.function === 'first.run'));
    assert.ok(result.trace.some(e => e.kind === 'dispatch' && e.function === 'second.run'));
});

test('service operation handlers execute typed calls and events through existing queues and correlations', async () => {
    const document = await valid(`
        interface service Api version "1.0.0" { operation work(input: int): int; function check(): int; event changed(value: int); }
        class def Server {
            port api: Api provides;
            var count: int = 0;
            operation execute(value: int): int on call api.work { count = count + 1; publish api.changed(value); return value + 1; }
            function check(): int on call api.check { return count; }
        }
        component def Client {
            port api: Api requires;
            var result: int = 0;
            var observed: int = 0;
            var calls: int = 0;
            operation run() on start {
                call api.work(5) as answer within 10 ns otherwise { fail "work failed"; };
                result = answer;
                call api.check() as total within 10 ns otherwise { fail "check failed"; };
                calls = total;
            }
            operation changed(value: int) on receive api.changed { observed = value; }
        }
        class Root {
            component frontend: Client;
            class backend: Server;
            connect apiRoute: frontend.api -> backend.api qos { delivery atMostOnce; ordering fifo; capacity 3; overflow reject; };
        }
        requirement Contract { doc /* The modeled service preserves the typed route. */ }
        satisfy Contract of Root.backend.execute;
        verificationCase Exchange of Root {
            verify Contract;
            call frontend.api.work -> backend.api.work via apiRoute label request;
            reply backend.api.work -> frontend.api.work via apiRoute after request label response;
        }
        view exchanges sv of Exchange;
    `);
    const result = simulate([document.parseResult.value], 'P::Root', { untilNs: 100 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual([result.stores.frontend.result, result.stores.frontend.observed, result.stores.frontend.calls, result.stores.backend.count], [6, 5, 1, 1]);
    assert.equal(result.trace.filter(e => e.kind === 'requestComplete').length, 2);
    assert.ok(result.trace.some(e => e.kind === 'emission' && e.source === 'backend.api.changed' && e.route === 'apiRoute'));
});

test('stateful operations retain direct state ownership and timer completion', async () => {
    const document = await valid(`class Root {
        var count: int = 0;
        operation lifecycle() on start {
            initial Waiting;
            state Waiting { entry { count = 1; } }
            state Done final { entry { count = 2; } }
            transition finish: Waiting -> Done on after 1 ns {}
        }
    }`);
    const result = simulate([document.parseResult.value], 'P::Root', { untilNs: 5 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores[''].count, 2);
    assert.ok(result.trace.some(e => e.kind === 'stateEntry' && e.state === 'Done'));
});

for (const broken of [
    'class def Broken { operation work(value:) {} }',
    'class def Broken { operation work() on manual {} }',
    'class def Broken { operation work() { calc amount { return value: int = ; } } }',
    'class def Broken { component child: ; }',
    'interface service Broken version "1.0.0" { operation work(value:); }'
]) test(`malformed class/operation input keeps diagnostics and recovers to a later root: ${broken}`, async () => {
    const document = await parse(`${broken} class Recovered { operation ready() on start {} }`);
    assert.ok(document.parseResult.lexerErrors.length + document.parseResult.parserErrors.length > 0);
    assert.ok(document.diagnostics?.some(d => d.severity === 1));
    assert.ok(document.parseResult.value.packages[0].elements.some(n => a.isRootComponent(n) && n.name === 'Recovered'));
});

test('class and operation are reserved category keywords rather than escaped identifiers', async () => {
    await invalid('class def class {}');
    await invalid('class Root { var operation: int = 1; }');
});
