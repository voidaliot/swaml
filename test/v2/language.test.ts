import nodeTest from 'node:test';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
import assert from 'node:assert/strict';
import { invalid, parse, valid, workspace } from './helpers.js';
import { selectView } from '../../src/language/presentation.js';
import * as a from '../../src/language/generated/ast.js';
const wrap = (members: string, extra = '') => `package Test { ${extra} component Demo { ${members} } }`;
for (const [name, source, code] of [
    ['duplicate names', wrap('attribute n: int = 0; attribute n: int = 1;'), 'SW2001'],
    ['wrong initializer', wrap('attribute n: int = true;'), 'SW2002'],
    ['private sibling state', 'package Test { component def C { attribute n: int = 0; } component Demo { component child: C; operation f() { var n: int = child.n; } } }', 'SW2002'],
    ['const assignment', wrap('const attribute n: int = 0; operation f() { n = 1; }'), 'SW2006'],
    ['input assignment', wrap('operation f(x: int) { x = 1; }'), 'SW2006'],
    ['nested capture', wrap('operation f(x: int) { operation g() returns int { return x; } var y: int = g(); }'), 'SW2002'],
    ['discarded result', wrap('operation f() returns int { return 1; } operation g() { f(); }'), 'SW2006'],
    ['missing return', wrap('operation f() returns int { if (true) { return 1; } }'), 'SW2006'],
    ['recursion', wrap('operation f() { f(); }'), 'SW2006'],
    ['mutual recursion', wrap('operation f() { g(); } operation g() { f(); }'), 'SW2006'],
    ['bad fallback', wrap('operation f() { var x: real = try(1.0 / 0.0, true); }'), 'SW2002'],
    ['missing fallback', wrap('operation f() { var x: real = try(1.0 / 0.0); }'), 'SW2002'],
    ['out literal', wrap('operation f(out x: int) { x = 1; } operation g() { f(0); }'), 'SW2006'],
    ['out expression', wrap('operation f(out x: int) { x = 1; } operation g() { var x: int = 0; if (f(x) == f(x)) { } }'), 'SW2006'],
    ['negative uint', wrap('attribute n: uint = -1;'), 'SW2002'],
    ['byte overflow', wrap('attribute n: byte = 256;'), 'SW2002'],
    ['array extent', wrap('attribute n: int[0] = [];'), 'SW2002'],
    ['static index', wrap('attribute n: int[2] = [1, 2]; operation f() { var x: int = n[2]; }'), 'SW2002'],
    ['zero duration', wrap('operation f() { wait 0ms; }'), 'SW2013'],
    ['unsafe duration', wrap('operation f() { wait 9007199254740991s; }'), 'SW2013'],
    ['nonbool condition', wrap('operation f() { while (1) { } }'), 'SW2002'],
    ['loop bound type', wrap('operation f() { while (true, 1.0 times) { } }'), 'SW2002'],
    ['duplicate schedule', wrap('operation f() { } schedule { on start f(); on start f(); }'), 'SW2007'],
    ['two schedule blocks', wrap('operation f() { } schedule { on start f(); } schedule { on every 1s f(); }'), 'SW2007'],
    ['period deadline', wrap('operation f() { } schedule { on every 1ms f() deadline 2ms; }'), 'SW2007'],
    ['after cycle', wrap('operation f() { } operation g() { } schedule { on start f(); after f g(); after g f(); }'), 'SW2007'],
    ['after unscheduled', wrap('operation f() { } operation g() { } schedule { after f g(); }'), 'SW2007'],
    ['concurrent writes', wrap('attribute n: int = 0; operation helper() { n = 1; } operation f() { helper(); } schedule { on start f() concurrent; }'), 'SW2006'],
    ['stateful concurrent', wrap('operation f() { initial A; state A { after 1ms to B { } } final state B { } } schedule { on start f() concurrent; }'), 'SW2006'],
    ['state signature', wrap('operation f(x: int) { initial A; final state A { } } schedule { on start f(0); }'), 'SW2008'],
    ['state reachability', wrap('operation f() { initial A; final state A { } state B { } } schedule { on start f(); }'), 'SW2008'],
    ['final transition', wrap('operation f() { initial A; final state A { after 1ms to A { } } } schedule { on start f(); }'), 'SW2008'],
    ['state periodic', wrap('operation f() { initial A; final state A { } } schedule { on every 1ms f(); }'), 'SW2008'],
    ['implicit override', 'package Test { component def C { attribute x: int = 0; } component Demo: C { attribute x: int = 2; } }', 'SW2003'],
    ['changed override type', 'package Test { component def C { attribute x: int = 0; } component Demo: C { redefines attribute x: bool = false; } }', 'SW2003'],
    ['inheritance cycle', 'package Test { component def A specializes B { } component def B specializes A { } }', 'SW2003'],
    ['containment cycle', 'package Test { component def C { component child: C; } component Demo: C; }', 'SW2003'],
    ['zero multiplicity', 'package Test { component def C { } component Demo { component child: C[0]; } }', 'SW2003'],
    ['record cycle', 'package Test { datatype A { self: A; } }', 'SW2002'],
    ['void data', wrap('attribute x: void = 0;'), 'SW2002'],
    ['missing record field', wrap('attribute x: R = record R { };', 'datatype R { x: int; }'), 'SW2002'],
    ['enum mismatch', wrap('attribute x: A = B.x;', 'enum A { x } enum B { x }'), 'SW2002'],
] as const)
    test(name, () => invalid(source, code));
for (const legacy of ['class def C { }', 'interface service P version "1.0" { }', 'component Demo service { }', 'component Demo { function f() { } }', 'component Demo { var n: int = 0; }', 'component Demo { operation f(): int { return 1; } }', 'component Demo { operation f() on start { } }', 'import Other::*;'])
    test(`rejects retired syntax: ${legacy}`, () => invalid(`package Test { ${legacy} }`));
for (const partial of ['package', 'package P { component', 'package P { component C { operation f( {', 'package P { port def X { provides operation f( ;', 'package P { component C { operation f() { try(; } }', 'package P { component C { schedule { on receive p.e( f(); } }'])
    test(`malformed recovery ${partial}`, async () => { const r = await parse(partial); assert.ok(r.errors.length); assert.ok(!r.errors.some(x => /exception/i.test(String(x.message)))); });
test('nested operations, contextual names, copied arrays and both loops', () => valid(wrap(`attribute times: int = 0; operation work() { operation double(v: int) returns int { return v * 2; } var from: int = double(2); while (from < 9, 3 times) { from = from + 1; } until (from > 9, 4 times) { from = from + 1; } for (var i: int = 0; i < 2; i = i + 1) { times = times + i; } for (v: int in [1, 2]) { times = times + v; } } schedule { on start work(); }`)));
test('operation usage keeps signature and whole-body replacement', () => valid('package Test { operation def Clamp(v: real) returns real { return v; } component Demo { operation narrow: Clamp { return 0.0; } operation f() { var x: real = narrow(1.0); } schedule { on start f(); } } }'));
test('typed root body redefines state and adds behavior', () => valid('package Test { component def C { attribute n: int = 0; operation set() { n = 1; } } component Demo: C { redefines attribute n: int = 4; operation go() { set(); } schedule { on start go(); } } }'));
test('pure library initializer and nominal value', () => valid('package Test { import Swaml::Math; enum Mode { off, active } component Demo { attribute v: int = floor(1.5); attribute m: Mode = Mode.active; } }'));
test('import and qualified multi-segment package resolution', async () => { const r = await workspace(['package Shared::Values { datatype R { v: int; } }', 'package Test { import Shared::Values; component Demo { attribute r: R = record R { v = 3; }; } }']); assert.deepEqual(r.docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []); });
test('ambiguous imports rejected independent of document order', async () => { const r = await workspace(['package A { datatype R { } }', 'package B { datatype R { } }', 'package Test { import A; import B; component Demo { attribute x: R = record R { }; } }']); assert.ok(r.docs[2].diagnostics?.some(x => x.severity === 1)); });
test('views use stable occurrence union and exact operation kind', async () => { const r = await valid('package Test { import Swaml::Views; component def C { operation tick() { } } component Demo { component cells: C[2]; } view v: General { include Demo recursive where kind == "operation"; include Demo.cells[0].tick; } }'); const v = r.model.packages[0].elements.find(a.isView)!; assert.deepEqual(selectView(v, [r.model]).map(s => s.path), ['Test::Demo.cells[0].tick', 'Test::Demo.cells[1].tick']); });
test('stale state read produces a structured warning', async () => { const r = await valid(wrap('attribute n: int = 1; operation f() { var before: int = n; wait 1ms; n = before + 1; } schedule { on start f(); }')); assert.ok(r.warnings.some(x => x.code === 'SW2011' && x.data.declaration)); });
