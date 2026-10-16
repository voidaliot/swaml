import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';

const wrap = (source: string) => `package P { ${source} }`;
async function diagnostics(source: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(wrap(source), { validation: true });
    const result = document.diagnostics ?? [];
    assert.ok(!result.some(d => String(d.message).includes('error occurred during validation')), JSON.stringify(result));
    return result;
}
async function valid(source: string) { assert.deepEqual(await diagnostics(source), []); }
async function invalid(source: string, code?: string) {
    assert.ok((await diagnostics(source)).some(d => d.severity === 1 && (!code || d.code === code)), source);
}

test('one component owns state, functions, calculations and nested components', () => valid(`
    component def Child { var value: uint = 0; }
    component def Composite {
        component child: Child;
        var count: int = 0;
        function run() on start {
            calc twice { in x: int; return result: int = x * 2; }
            count = twice(4); call check(); }
        function check() { assert count == 8; }
    }
    component Demo: Composite;
`));
test('inline root owns local state, calculations and stateful functions', () => valid(`
    component Demo {
        var value: byte = 1;
        function run() on start {
            calc plus { in x: byte; return result: uint = x + 1; }
            initial Waiting; state Waiting { entry { value = plus(value); } } }
        deploy Demo on "sysml:Vehicle::ecu";
    }
    view Flow fv of Demo.run;
`));
test('component specialization inherits local scope and supports explicit redefinition', () => valid(`
    component def Base {
        var total: int = 0;
        function helper() {
            calc amount { return result: int = 1; }
            total = amount(); }
        function run() on start { call helper(); }
    }
    component def Derived specializes Base {
        redefines var total: int = 10;
        redefines function helper() { calc amount { return result: int = 2; } total = amount() + 1; }
    }
    component Demo: Derived;
    view Inherited fv of Demo.run;
`));
test('specialized child replacement preserves nominal component compatibility', () => valid(`
    component def Child { var total: int = 1; }
    component def Better specializes Child { redefines var total: int = 2; }
    component def Base { component child: Child; }
    component def Derived specializes Base { redefines component child: Better; }
    component Demo: Derived;
`));
for (const members of [
    'var count: int = 2;',
    'redefines var absent: int = 2;',
    'redefines var count: string = "bad";',
    'redefines function count() {}'
]) test(`invalid inherited replacement ${members}`, () => invalid(`component def Base { var count: int = 1; } component def Derived specializes Base { ${members} }`, 'SW014'));
test('unrelated child cannot replace a component type', () => invalid(`component def Child {} component def Other {} component def Base { component child: Child; } component def Derived specializes Base { redefines component child: Other; }`, 'SW014'));
for (const replacement of [
    'redefines function work(x: real) {}',
    'redefines function work(y: int) {}',
    'redefines function work(x: int): int { return x; }',
    'redefines function work(x: int) on manual {}'
]) test(`function redefinition preserves contract ${replacement}`, () => invalid(`component def Base { function work(x: int) {} } component def Derived specializes Base { ${replacement} }`, 'SW014'));
test('inheritance cycles yield a stable diagnostic', () => invalid('component def A specializes B {} component def B specializes A {}', 'SW015'));
test('self specialization terminates diagnostics', () => invalid('component def A specializes A {}', 'SW015'));
test('inherited containment cycles are rejected', () => invalid('component def Base { component child: Derived; } component def Derived specializes Base {}', 'SW013'));
test('override effects are checked through inherited reentrant entry points', () => invalid(`
    component def Base {
        var count: int = 0;
        function run() on manual timing { wcet 1 ms; deadline 2 ms; concurrency reentrant; } { call helper(); }
        function helper() {}
    }
    component def Derived specializes Base { redefines function helper() { count = 1; } }
`, 'SW054'));
test('override-introduced helper recursion is detected', () => invalid(`component def Base { function beginWork() { call helper(); } function helper() {} } component def Derived specializes Base { redefines function helper() { call beginWork(); } }`, 'SW056'));
test('calculations cannot read mutable state', () => invalid('component def C { var secret: int = 0; function run() { calc value { return result: int = secret; } } }', 'SW022'));
test('calculations cannot call executable functions as expressions', () => invalid('component def C { function value(): int { return 1; } function run() { calc result { return value: int = value(); } } }'));
test('calculation input and output names are distinct', () => invalid('component def C { function run() { calc value { in x: int; return x: int = x; } } }', 'SW002'));
test('calculations cannot return void', () => invalid('component def C { function run() { calc value { return result: void = 1; } } }', 'SW020'));
test('local function lookup cannot escape to another component', () => invalid('component def A { function hidden() {} } component def B { function run() { call hidden(); } }'));
test('parent cannot access child private state', () => invalid('component def Child { var privateValue: int = 1; } component def Parent { component child: Child; function run() { assert child.privateValue == 1; } }', 'SW022'));
test('parent and child communicate through explicit owned ports', () => valid(`
    interface senderReceiver Data version "1.0.0" { data value: int queued; }
    component def Child { port input: Data receiver; function acceptValue(value: int) on receive input.value {} }
    component def Parent {
        component child: Child;
        port output: Data sender;
        function run() on start { send output.value(2); }
        connect route: output -> child.input qos { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; };
    }
    component Demo: Parent;
`));
test('explicit typed routes may connect two ports owned by the same component', () => valid(`
    interface publishSubscribe Events version "1.0.0" { event tick(); }
    qos def Queue { delivery atMostOnce; ordering fifo; capacity 2; overflow reject; }
    component def Loopback {
        port output: Events publisher;
        port input: Events subscriber;
        function emit() on start { publish output.tick(); }
        function acceptTick() on receive input.tick {}
    }
    component Demo {
        component child: Loopback;
        port output: Events publisher;
        port input: Events subscriber;
        function emit() on start { publish output.tick(); }
        function acceptTick() on receive input.tick {}
        connect ownRoute: output -> input qos Queue;
        connect childRoute: child.output -> child.input qos Queue;
    }
`));
test('delegated port cannot also have a local handler', () => invalid(`
    interface publishSubscribe Events version "1.0.0" { event tick(); }
    component def Child { port input: Events subscriber; function tick() on receive input.tick {} }
    component def Parent { component child: Child; port input: Events subscriber; delegate input -> child.input; function tick() on receive input.tick {} }
`, 'SW033'));
const routed = `
    interface publishSubscribe Events version "1.0.0" { event tick(); }
    component def Child { port input: Events subscriber; function tick() on receive input.tick {} }
    component def Base { component child: Child; port input: Events subscriber; delegate input -> child.input; }
`;
test('inherited ports, delegation and child behavior remain usable', () => valid(`${routed}
    component def Derived specializes Base { redefines port input: Events subscriber; redefines delegate input -> child.input; }
`));
test('port redefinition cannot weaken required boundary', () => invalid(`${routed} component def Derived specializes Base { redefines port input: Events subscriber optional; }`, 'SW014'));
test('delegation redefinition cannot redirect inherited boundary', () => invalid(`${routed} component def Derived specializes Base { component other: Child; redefines delegate input -> other.input; }`, 'SW014'));
test('inline roots cannot alias the same child port twice', () => invalid(`
    interface publishSubscribe Events version "1.0.0" { event tick(); }
    component def Child { port input: Events subscriber optional; function tick() on receive input.tick {} }
    component Demo {
        component child: Child;
        port first: Events subscriber optional;
        port second: Events subscriber optional;
        delegate first -> child.input;
        delegate second -> child.input;
    }
`, 'SW033'));
test('function redefinition cannot weaken inherited timing', () => invalid(`component def Base { function work() timing { wcet 1 ms; deadline 2 ms; concurrency serial; } {} } component def Derived specializes Base { redefines function work() timing { wcet 2 ms; deadline 3 ms; concurrency serial; } {} }`, 'SW014'));
test('function redefinition may strengthen inherited timing', () => valid(`component def Base { function work() timing { wcet 2 ms; deadline 4 ms; concurrency serial; } {} } component def Derived specializes Base { redefines function work() timing { wcet 1 ms; deadline 2 ms; concurrency serial; } {} }`));
test('root and child deployment names must be unambiguous', () => invalid('component def C {} component Demo { component Demo: C; deploy Demo on "sysml:Vehicle::ecu"; }', 'SW070'));
test('fixed arrays do not silently convert their element domains', () => invalid('component Demo { var bytes: byte[2] = [0, 1]; function work() { var counts: uint[2] = bytes; } }', 'SW023'));
test('typed root only binds existing deployment', () => invalid('component def C {} component Demo: C { function extra() {} }', 'SW012'));
test('deployment requires an external reference', () => invalid('component Demo { deploy Demo on ""; }', 'SW070'));
test('deployment rejects a bare local platform name', () => invalid('component Demo { deploy Demo on "ecu"; }', 'SW070'));
for (const source of ['unit def Old {}', 'component def C { operation run() {} }', 'component Demo { node host process; }', 'component def C { function f(x: int): int = x; }']) test(`old authoring form is rejected ${source}`, () => invalid(source));
test('unsigned and byte domains support checked integral assignments', () => valid('component Demo { var b: byte = 255; var u: uint = 9007199254740991; var bytes: byte[2] = [0, 255]; function run() { var small: byte = b; var count: uint = b + 1; var signed: int = u; var decimal: real = b; assert bytes[b - 255] == 0; } }'));
for (const declaration of ['var x: byte = 256;', 'var x: byte = -1;', 'var x: uint = -1;', 'var x: uint = 9007199254740992;', 'var x: byte = 250 + 6;', 'var x: byte[2] = [0, 256];']) test(`numeric domain rejects ${declaration}`, () => invalid(`component Demo { ${declaration} }`, 'SW025'));
test('real cannot narrow to integral through assignment', () => invalid('component Demo { var x: uint = 1.0; }', 'SW023'));
for (const source of ['component def C specializes {', 'component def C { calc f { in :; return result: int = ; } }', 'component def C { redefines function () { initial ; state { } } }']) test(`new syntax malformed recovery ${source}`, () => invalid(source));
test('qualified imported specialization resolves inherited functions and their lexical calculations', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const parse = parseHelper<Model>(Swaml);
    const base = await parse('package Library { component def Base { function value(): uint { calc identity { in x: uint; return result: uint = x; } return identity(1); } } }', { documentUri: 'memory:///base.swaml' });
    const use = await parse('package App { component def Derived specializes Library::Base { function run() { call value() as x; } } component Demo: Derived; }', { documentUri: 'memory:///use.swaml' });
    await Swaml.shared.workspace.DocumentBuilder.build([base, use], { validation: true });
    assert.deepEqual(base.diagnostics, []);
    assert.deepEqual(use.diagnostics, []);
});
