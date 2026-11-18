// swa.ml 2.3 work package WP1: places, selector reads and literal component indexes in test paths.
// Every WP1 rule identifier is named in at least one test title below.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { expressionTypes, testCanAccess, caseTarget } from '../../src/language/semantic.js';
import { runCase, simulate } from '../../src/simulation/simulator.js';
import * as a from '../../src/language/generated/ast.js';
import { invalid, parse, run, valid } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const wrap = (body: string) => `package Test {
  datatype Status { confirmed: bool; occurrences: int; }
  datatype Log { statuses: Status[3]; tag: string; }
  datatype Fleet { logs: Log[2]; count: int; }
  component def D {
    ${body}
  }
  component Demo: D;
}`;
const statuses = '[record Status { confirmed = false; occurrences = 0; }, record Status { confirmed = false; occurrences = 0; }, record Status { confirmed = false; occurrences = 0; }]';
const log = (tag: string) => `record Log { statuses = ${statuses}; tag = "${tag}"; }`;
const fleet = `record Fleet { logs = [${log('a')}, ${log('b')}]; count = 0; }`;
const errors = async (source: string) => (await parse(source)).errors.map(e => [e.code, e.message]);
const writes = (trace: { kind: string }[]) => trace.filter(t => t.kind === 'write') as unknown as { subject: string; scope: string; value: unknown; place?: string; source?: string }[];

// ---------------------------------------------------------------- grammar

test('WP1-G01 assignment targets are places: index, then fields and indexes; a dotted target too', async () => {
    const r = await valid(wrap(`attribute statuses: Status[3] = ${statuses}; attribute fleet: Fleet = ${fleet};
      operation f() { var i: int = 1; statuses[i].confirmed = true; fleet.count = 2; fleet.logs[0].statuses[i].occurrences = 3; } schedule { on start f(); }`));
    const assigns = r.model.packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isOperation)[0].body.statements.filter(a.isAssign);
    assert.deepEqual(assigns.map(x => [x.target, !!x.index, x.selectors.map(s => s.field ?? '[]')]), [['statuses', true, ['confirmed']], ['fleet.count', false, []], ['fleet.logs', true, ['statuses', '[]', 'occurrences']]]);
});

test('WP1-G01 the for header update keeps a bare name', async () => {
    const r = await parse(wrap('attribute xs: int[2] = [0, 0]; operation f() { for (var i: int = 0; i < 2; xs[0] = i) { } } schedule { on start f(); }'));
    assert.ok(r.errors.some(e => e.code === 'SW2000'), JSON.stringify(r.errors));
});

test('WP1-G02 a value reference continues after its first index with selectors', async () => {
    const r = await valid(wrap(`attribute fleet: Fleet = ${fleet}; attribute seen: bool = false;
      operation f() { var i: int = 1; seen = fleet.logs[i].statuses[2].confirmed; } schedule { on start f(); }`));
    const ref = r.model.packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isOperation)[0].body.statements.filter(a.isAssign)[0].value as a.ReferenceExpression;
    assert.equal(ref.path, 'fleet.logs');
    assert.deepEqual(ref.selectors.map(s => s.field ?? (s.index as a.Literal).number), ['statuses', 2, 'confirmed']);
    assert.equal(expressionTypes.get(ref), 'bool');
});

test('WP1-G03 call paths admit literal indexes only; a read path may hold an expression index', async () => {
    const p = await parse('package T { test X { backend.twins[0].currentView(); } }');
    assert.equal(p.doc.parseResult.parserErrors.length, 0);
    const call = ((p.model.packages[0].elements[0] as a.Scenario).statements[0] as a.ExpressionStatement).expression as a.CallExpression;
    assert.equal(call.target, 'backend.twins[0].currentView');
    assert.ok((await parse('package T { test X { backend.twins[i].currentView(); } }')).doc.parseResult.parserErrors.length > 0, 'a call path takes a literal index');
    const read = await parse('package T { test X { assert backend.twins[i].link; } }');
    assert.equal(read.doc.parseResult.parserErrors.length, 0, 'the read parses and is rejected by WP1-S06');
});

test('WP1-G01 WP1-G02 WP1-G03 (gate 3) parsing every new form prints no parser warning', async () => {
    const logged: string[] = [], saved = [console.log, console.warn, console.error];
    console.log = console.warn = console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
    try {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const text of ['a[i].f = 1;', 'r.f = 2;', 'a[i][j] = 3;', 'a[0].b.c[2].d = q[1][2];', 'x = recent[i].vehicleId;', 'y = b.t[0].link;', 'b.t[0].go();', 'g(a[1].x);', 'a[0];', 'x = a[0].f(1);'])
            Swaml.parser.LangiumParser.parse(`package P { component def C { operation f() { ${text} } } }`);
    }
    finally {
        [console.log, console.warn, console.error] = saved;
    }
    assert.deepEqual(logged, []);
});

test('malformed places and selectors recover without exceptions', async () => {
    for (const text of ['a[ = 1;', 'a[1]. = 2;', 'a[1].f = ;', 'x = r[1].;', 'x = r[1][;', 'a[1]..f = 1;', 'backend.twins[i].go();', 'a[1].f(;']) {
        const r = await parse(wrap(`attribute a: int[2] = [0, 0]; operation f() { ${text} } schedule { on start f(); }`));
        assert.ok(r.errors.some(e => e.code === 'SW2000'), text);
        assert.ok(!r.errors.some(e => /exception|cannot read|undefined/i.test(String(e.message))), text + ': ' + JSON.stringify(r.errors));
    }
});

// Statement recovery: a place or selector being typed keeps the rest of its component, with at most the
// syntax errors the kept 2.2 grammar (the 3.1.0 parser) reports for the same text.
const kept22 = async () => {
    const { parsers } = await import(new URL('../../../scripts/compatibility-2-2.mjs', import.meta.url).href) as { parsers(): Promise<{ kept: { parser: { LangiumParser: { parse(text: string): { parserErrors: unknown[]; lexerErrors: unknown[] } } } } }> };
    return (await parsers()).kept.parser.LangiumParser;
};
const typing = (line: string) => `package Test {
  datatype S { n: int; xs: int[2]; }
  component def D {
    attribute a: int[3] = [1, 2, 3];
    attribute r: S = record S { n = 1; xs = [1, 2]; };
    attribute out1: int = 0;
    operation run() {
      out1 = 1;
      ${line}
      out1 = 2;
      out1 = 3;
    }
    operation other() { out1 = 4; }
    schedule { on start run(); }
  }
  component Demo: D;
}`;
test('WP1-G01 WP1-G02 an incomplete place, selector read or 2.2 read statement keeps the rest of its component', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const line of ['a[ = 1;', 'a[0', 'a[0]', 'a[0] =', 'a[0]. = 2;', 'r. = 2;', 'r.n', 'r.xs[0]', 'out1', 'out1 = a[', 'out1 = r.', 'foo(a[0]', 'a[out1 + ] = 1;', 'a[0] = 1', 'r.n =', 'a[0].', 'r.xs[0].n', 'out1 = r.xs[0].', 'out1 = a[0][', 'a[0][1', 'r.xs[0] = r.xs[', 'out1 = r.xs[0]', 'foo(r.xs[0].', 'a[0].go(', 'a[0].go()']) {
        const text = typing(line), now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text);
        const errors = now.parserErrors.length + now.lexerErrors.length, limit = Math.max(1, before.parserErrors.length + before.lexerErrors.length);
        assert.ok(errors <= limit, `${line}: ${errors} errors, 2.2 had ${limit}`);
        const d = (now.value as a.Model).packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'D')!;
        const run = d.members.filter(a.isOperation).find(o => o.name === 'run')!;
        // A line that ends in = may take the next line's start as its value; the statement after it survives.
        assert.equal(run.body.statements.at(-1)?.$cstNode?.text, 'out1 = 3;', line);
        assert.ok(d.members.some(m => a.isOperation(m) && m.name === 'other') && d.members.some(a.isSchedule), line);
        assert.ok((now.value as a.Model).packages[0].elements.some(e => a.isComponentUsage(e) && e.name === 'Demo'), line);
    }
});
test('WP1-G03 an incomplete indexed test path keeps the rest of its package', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const line of ['backend.twins[1 + 0].join();', 'backend.twins[i].join();', 'backend.twins[0].', 'backend.twins[0].join(', 'assert backend.twins[0].', 'var v: int = backend.twins[0].snapshot.ids[', 'backend.twins[0].join(1)', 'assert backend.twins[0].link']) {
        const text = twins(`${line}\n    assert true;\n    assert probe.n == 0;`) + '\npackage After { }';
        const now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text);
        const errors = now.parserErrors.length, limit = Math.max(1, before.parserErrors.length);
        assert.ok(errors <= limit, `${line}: ${errors} errors, 2.2 had ${limit}`);
        const model = now.value as a.Model, fleet = model.packages[0], scenario = fleet.elements.find(a.isScenario)!;
        assert.deepEqual(scenario.statements.slice(-2).map(s => s.$cstNode?.text), ['assert true;', 'assert probe.n == 0;'], line);
        assert.equal(fleet.associations.length, 1, line);
        assert.deepEqual(model.packages.map(p => p.name), ['Fleet', 'After'], line);
    }
});

// ---------------------------------------------------------------- static rules

test('WP1-S05 WP1-D01 WP1-S01 place roots: mutable locals, out parameters and non-const attributes only', async () => {
    const body = (statement: string) => wrap(`port p: Ping; component kid: Kid; attribute xs: Status[3] = ${statuses}; const attribute limits: int[2] = [1, 2];
      operation emit() { publish p.ping(); }
      operation f(v: Status[3], out o: Status[3]) { o = v; ${statement} } schedule { on start emit(); }`).replace('package Test {', 'package Test { port def Ping { provides event ping(); } component def Kid { attribute n: int = 0; }').replace('component Demo: D;', 'component Demo: D; component sink { reversed port p: Ping; operation take() { } schedule { on receive p.ping() take(); } } connect (Demo.p, sink.p);');
    await valid(body('xs[0].confirmed = true; o[1].occurrences = 2; var local: Status[3] = v; local[2].confirmed = true;'));
    for (const [statement, message] of [
        ['v[0].confirmed = true;', 'Cannot assign to v[0].confirmed: v is an in parameter.'],
        ['limits[0] = 3;', 'Cannot assign to limits[0]: limits is a const attribute.'],
        ['p.ping = 1;', 'Cannot assign to p.ping: p is a port.'],
        ['kid.n = 1;', 'Cannot assign to kid.n: kid is a child component.'],
        ['Test::Demo.n = 1;', 'Cannot assign to Test::Demo.n: Test::Demo is a qualified name.'],
        ['missing.n = 1;', 'Cannot assign to missing.n: missing is not a local, out parameter or attribute.'],
        ['for (s: Status in v) { s.confirmed = true; }', 'Cannot assign to s.confirmed: s is an immutable binding.'],
    ]) {
        const found = await errors(body(statement));
        assert.ok(found.some(([code, m]) => code === 'SW2006' && m === message), statement + ' ' + JSON.stringify(found));
    }
});

test('WP1-S05 WP1-D01 a dotted assignment without an index is a place; a bare name keeps its 2.2 message', async () => {
    const r = await run(wrap(`attribute fleet: Fleet = ${fleet}; operation f() { fleet.count = 4; fleet.logs[1].tag = "z"; } schedule { on start f(); }`));
    assert.equal((r.stores.Demo.fleet as { count: number }).count, 4);
    assert.equal(writes(r.trace)[0].place, 'fleet.count');
    const found = await errors(wrap('const attribute n: int = 0; operation f() { n = 1; } schedule { on start f(); }'));
    assert.ok(found.some(([code, m]) => code === 'SW2006' && m === 'Cannot assign n; inputs and const attributes are immutable.'), JSON.stringify(found));
});

test('WP1-S02 WP1-D04 selector typing: fields of records, integral indexes of arrays, the selected type', async () => {
    const op = (statement: string) => wrap(`attribute fleet: Fleet = ${fleet}; attribute xs: int[3] = [1, 2, 3]; attribute out1: bool = false; operation f() { var i: int = 0; var r: real = 1.0; ${statement} } schedule { on start f(); }`);
    await valid(op('out1 = fleet.logs[i].statuses[i].confirmed; fleet.logs[i].statuses[i].occurrences = xs[i] + 1;'));
    for (const [statement, message] of [
        ['fleet.logs[0].missing = 1;', 'Test::Log has no field missing.'],
        ['fleet.logs[0].tag[0] = 1;', 'string is not an array and cannot be indexed.'],
        ['fleet.logs[r].tag = "x";', 'Index must be integral, found real.'],
        ['out1 = fleet.logs[0].statuses[0].nope;', 'Test::Status has no field nope.'],
        ['out1 = xs[0].f;', 'int has no field f.'],
        ['out1 = fleet.logs[0].statuses[r].confirmed;', 'Index must be integral, found real.'],
        ['fleet.logs[0].statuses[0].confirmed = 3;', 'Expected bool, received int.'],
        ['fleet.count.x = 1;', 'int has no field x.'],
    ]) {
        const found = await errors(op(statement));
        assert.ok(found.some(([code, m]) => code === 'SW2002' && m === message), statement + ' ' + JSON.stringify(found));
    }
    // An enum literal has no fields or elements.
    const enumRead = await errors(wrap('attribute out1: bool = false; operation f() { out1 = Mode.up[0].x == Mode.up; } schedule { on start f(); }').replace('package Test {', 'package Test { enum Mode { up, down }'));
    assert.ok(enumRead.some(([code, m]) => code === 'SW2002' && m === 'Test::Mode is not an array and cannot be indexed.'), JSON.stringify(enumRead));
});

test('WP1-S03 WP1-D04 a literal index outside the extent is a static error at every selector position', async () => {
    const op = (statement: string) => wrap(`attribute fleet: Fleet = ${fleet}; attribute out1: bool = false; operation f() { ${statement} } schedule { on start f(); }`);
    for (const [statement, message] of [
        ['fleet.logs[2].tag = "x";', 'Index 2 is outside Test::Log[2].'],
        ['fleet.logs[0].statuses[3].confirmed = true;', 'Index 3 is outside Test::Status[3].'],
        ['fleet.logs[-1].tag = "x";', 'Index -1 is outside Test::Log[2].'],
        ['out1 = fleet.logs[1].statuses[5].confirmed;', 'Index 5 is outside Test::Status[3].'],
    ]) {
        const found = await errors(op(statement));
        assert.ok(found.some(([code, m]) => code === 'SW2002' && m === message), statement + ' ' + JSON.stringify(found));
    }
});

test('WP1-S04 WP1-D03 a place is not an out argument; out arguments stay bare names', async () => {
    const op = (argument: string) => wrap(`attribute fleet: Fleet = ${fleet}; attribute n: int = 0; operation put(out v: int) { v = 1; } operation f() { put(${argument}); } schedule { on start f(); }`);
    await valid(op('n'));
    for (const [argument, message] of [
        ['fleet.logs[0].statuses[1].occurrences', 'An out argument must be a name; fleet.logs[0].statuses[1].occurrences is a place.'],
        ['fleet.logs[1].tag', 'An out argument must be a name; fleet.logs[1].tag is a place.'],
        // 2.2 forms keep the 2.2 message (review F3).
        ['fleet.count', 'An out argument needs a mutable compatible local, out parameter or attribute.'],
        ['fleet.logs[0]', 'An out argument needs a mutable compatible local, out parameter or attribute.'],
    ]) {
        const found = await errors(op(argument));
        assert.ok(found.some(([code, m]) => code === 'SW2006' && m === message), argument + ' ' + JSON.stringify(found));
    }
});

test('WP1-S07 WP1-D02 an out root must be definitely assigned before a place assignment', async () => {
    const op = (statements: string) => wrap(`operation fill(c: bool, out o: Status[3]) { ${statements} } operation f() { var s: Status[3] = ${statuses}; fill(true, s); } schedule { on start f(); }`);
    await valid(op(`o = ${statuses}; o[1].confirmed = true;`));
    await valid(op(`if (c) { o = ${statuses}; } else { o = ${statuses}; } o[0].occurrences = 1;`));
    for (const statements of [`o[1].confirmed = true; o = ${statuses};`, `if (c) { o = ${statuses}; } o[0].occurrences = 1; o = ${statuses};`]) {
        const found = await errors(op(statements));
        assert.ok(found.some(([code, m]) => code === 'SW2006' && /^Out parameter o must be assigned before o\[[01]\]\.(confirmed|occurrences) is assigned\.$/.test(String(m))), JSON.stringify(found));
    }
    // A place write does not assign the whole out parameter, so it still needs an assignment before return.
    const found = await errors(op(`o[1].confirmed = true;`));
    assert.ok(found.some(([, m]) => m === 'Out parameter o must be assigned before successful return.'), JSON.stringify(found));
});

test('WP1-S08 WP1-D07 an indexed call path outside a test is an error', async () => {
    const found = await errors(wrap('component kids: D2[2]; operation f() { kids[0].go(); } schedule { on start f(); }').replace('component def D {', 'component def D2 { operation go() { } } component def D {'));
    assert.ok(found.some(([code, m]) => code === 'SW2006' && m === 'kids[0].go: an indexed call path is allowed only in a test.'), JSON.stringify(found));
});

// ---------------------------------------------------------------- tests and indexed parts (B11a)

const twins = (statements: string, kind = 'test', associate = 'associate backend to Twins;') => `package Fleet {
  datatype Snapshot { speed: int; ids: int[2]; }
  port def Alerts { provides event raised(id: int); }
  component def Twin {
    attribute link: bool = false;
    attribute snapshot: Snapshot = record Snapshot { speed = 0; ids = [0, 0]; };
    operation join(id: int) { link = true; snapshot.ids[1] = id; }
    operation currentView() returns Snapshot { return snapshot; }
    operation slow() { wait 1ms; }
  }
  component def Backend { component twins: Twin[3]; component single: Twin; }
  component def Probe { attribute n: int = 0; }
  component backend: Backend;
  component probe: Probe;
  ${kind} Twins of probe { ${statements} }
  ${associate}
}`;

test('WP1-S06 a test reads and calls a part family member with a literal index', async () => {
    const r = await valid(twins('backend.twins[1].join(7); assert backend.twins[1].link; assert not backend.twins[0].link; assert backend.twins[1].snapshot.ids[1] == 7; var v: Snapshot = backend.twins[1].currentView(); assert v.ids[1] == 7; v.ids[1] = 9; assert backend.twins[1].snapshot.ids[1] == 7;'));
    const result = runCase([r.model], 'Fleet::Twins', { untilNs: 1000 });
    assert.equal(result.result, 'pass', result.message);
    assert.deepEqual(result.run?.stores['backend.twins[1]'], { link: true, snapshot: { speed: 0, ids: [0, 7] } });
    assert.deepEqual(result.run?.stores['backend.twins[0]'], { link: false, snapshot: { speed: 0, ids: [0, 0] } });
    const scenario = r.model.packages[0].elements.find(a.isScenario)!;
    assert.equal(testCanAccess(scenario, 'backend.twins[2]'), true);
    for (const path of ['backend.twins[3]', 'backend.twins', 'backend.single[0]', 'probe.twins[0]'])
        assert.equal(testCanAccess(scenario, path), false, path);
    assert.equal(caseTarget(scenario, 'backend.twins[2].join')?.kind, 'operation');
    assert.equal(caseTarget(scenario, 'backend.twins[3].join'), undefined);
});

test('WP1-S06 WP1-D05 WP1-D06 component indexes: literal, inside the multiplicity, only on families', async () => {
    for (const [statements, code, message] of [
        ['var i: int = 0; assert backend.twins[i].link;', 'SW2010', 'Component index in backend.twins[i] must be a literal.'],
        ['assert backend.twins[0 + 1].link;', 'SW2010', 'Component index in backend.twins[0 + 1] must be a literal.'],
        ['assert backend.twins[3].link;', 'SW2002', 'Index 3 is outside the multiplicity 3 of backend.twins.'],
        ['backend.twins[3].join(1);', 'SW2002', 'Index 3 is outside the multiplicity 3 of backend.twins.'],
        ['assert backend.single[0].link;', 'SW2002', 'backend.single is a single part and takes no index.'],
        ['backend.single[0].join(1);', 'SW2002', 'backend.single is a single part and takes no index.'],
    ]) {
        const found = await errors(twins(statements));
        assert.ok(found.some(([c, m]) => c === code && m === message), statements + ' ' + JSON.stringify(found));
    }
    // An unindexed family stays unknown, as in 2.2.
    assert.ok((await errors(twins('assert backend.twins.link;'))).some(([c]) => c === 'SW2002'));
});

test('WP1-S06 indexed parts keep the test-access rules: association, helper effects, use cases and roots', async () => {
    assert.ok((await errors(twins('assert backend.twins[0].link;', 'test', ''))).some(([c, m]) => c === 'SW2010' && String(m).includes('backend.twins[0] is not an accessible occurrence')));
    assert.ok((await errors(twins('backend.twins[0].slow();'))).some(([c]) => c === 'SW2006'), 'a suspending helper of an indexed part');
    const useCase = await errors(twins('assert backend.twins[0].link; backend.twins[0].join(1);', 'use case'));
    assert.ok(useCase.some(([c, m]) => c === 'SW2010' && String(m).startsWith('Private attribute access belongs to tests.')), JSON.stringify(useCase));
    assert.ok(useCase.some(([c, m]) => c === 'SW2006' && m === 'backend.twins[0].join: an indexed call path is allowed only in a test.'), JSON.stringify(useCase));
});

// ---------------------------------------------------------------- runtime rules and evidence

test('WP1-R01 WP1-T01 indexes left to right, then the right side, then the root; right-side writes are kept', async () => {
    const r = await run(wrap(`attribute counters: int[3] = [0, 0, 0]; attribute order: int = 0;
      operation first() returns int { order = order * 10 + 1; return 0; }
      operation second() returns int { order = order * 10 + 2; counters[1] = 5; return 1; }
      operation bump() returns int { order = order * 10 + 3; counters[2] = 40; return 7; }
      operation f() { counters[second() - first()] = bump(); } schedule { on start f(); }`));
    // second() is the left operand of the index; first() follows it; bump() is the right side and runs last.
    assert.equal(r.stores.Demo.order, 213);
    assert.deepEqual(r.stores.Demo.counters, [0, 7, 40]);
    // The right side's own place writes come first and are kept; the target's write replaces exactly one element.
    const place = writes(r.trace).filter(w => w.place);
    assert.deepEqual(place.map(w => [w.subject, w.scope, w.place, w.value]), [['Demo.counters', 'attribute', 'counters[1]', [0, 5, 0]], ['Demo.counters', 'attribute', 'counters[2]', [0, 5, 40]], ['Demo.counters', 'attribute', 'counters[1]', [0, 7, 40]]]);
    assert.equal(place[2].source, 'Test::D.f/0');
    // Only place writes carry place; a whole write keeps the 2.2 observation.
    assert.ok(writes(r.trace).filter(w => w.subject === 'Demo.order').every(w => !('place' in w)));
});

test('WP1-R01 WP1-R04 indexes of nested selectors evaluate left to right, before the right side', async () => {
    const r = await run(wrap(`attribute fleet: Fleet = ${fleet}; attribute order: int = 0; attribute seen: int = 0;
      operation one() returns int { order = order * 10 + 1; return 1; }
      operation two() returns int { order = order * 10 + 2; return 2; }
      operation three() returns int { order = order * 10 + 3; return 3; }
      operation f() { fleet.logs[one()].statuses[two()].occurrences = three(); seen = order; order = 0; seen = seen * 1000 + fleet.logs[one()].statuses[two()].occurrences; }
      schedule { on start f(); }`));
    assert.equal(r.stores.Demo.seen, 123003);
    const place = writes(r.trace).find(w => w.place)!;
    assert.equal(place.place, 'fleet.logs[1].statuses[2].occurrences');
    assert.equal((place.value as { logs: { statuses: { occurrences: number }[] }[] }).logs[1].statuses[2].occurrences, 3);
});

test('WP1-R02 WP1-R04 a bad index is Bounds on every level and leaves the root unchanged', async () => {
    for (const statement of ['fleet.logs[i].tag = "x";', 'fleet.logs[0].statuses[i].confirmed = true;', 'fleet.logs[1].statuses[j].confirmed = true;', 'seen = fleet.logs[0].statuses[i].confirmed;']) {
        const r = await run(wrap(`attribute fleet: Fleet = ${fleet}; attribute seen: bool = false; operation f() { var i: int = 3; var j: int = -1; fleet.count = 1; ${statement} } schedule { on start f(); }`));
        const failure = r.trace.find(t => t.kind === 'failure') as unknown as { reason: string } | undefined;
        assert.equal(failure?.reason, 'Bounds', statement);
        assert.deepEqual((r.stores.Demo.fleet as { count: number }).count, 1, statement);
        assert.equal(JSON.stringify((r.stores.Demo.fleet as { logs: unknown }).logs), JSON.stringify(JSON.parse(JSON.stringify([{ statuses: Array(3).fill({ confirmed: false, occurrences: 0 }), tag: 'a' }, { statuses: Array(3).fill({ confirmed: false, occurrences: 0 }), tag: 'b' }]))), statement);
        assert.deepEqual(writes(r.trace).flatMap(w => w.place ? [w.place] : []), ['fleet.count'], statement);
    }
    // A Bounds failure in the target is caught by try only around an expression; a place statement fails the activation.
    const caught = await run(wrap(`attribute xs: int[2] = [0, 0]; attribute n: int = 0; operation f() { var i: int = 2; n = try(xs[i], 9); xs[1] = n; } schedule { on start f(); }`));
    assert.deepEqual(caught.stores.Demo.xs, [0, 9]);
});

test('WP1-R03 the read-modify-write follows the resumption of a suspending right side under the serial lock', async () => {
    const r = await run(wrap(`attribute values: int[3] = [0, 0, 0]; attribute cursor: int = 0;
      operation fetch() returns int { wait 1ms; return 7; }
      operation writer() { values[cursor] = fetch(); }
      operation other() { wait 500us; values[1] = 5; cursor = 2; }
      schedule { on start writer(); on start other(); }`));
    // The index was evaluated before the suspension (0); the root was read after it, so the write of other is kept.
    assert.deepEqual(r.stores.Demo.values, [7, 5, 0]);
    const place = writes(r.trace).filter(w => w.place);
    assert.deepEqual(place.map(w => [w.place, w.value]), [['values[1]', [0, 5, 0]], ['values[0]', [7, 5, 0]]]);
    const writer = r.trace.find(t => t.kind === 'write' && (t as unknown as { place?: string }).place === 'values[0]')!;
    assert.equal(writer.timeNs, 1000000);
});

test('WP1-M01 SW2011 treats a place write as a write of its root and tracks indexes read before a suspension', async () => {
    const stale = async (body: string) => (await parse(wrap(body))).warnings.filter(w => w.code === 'SW2011').map(w => w.message);
    const base = 'attribute values: int[3] = [0, 0, 0]; attribute cursor: int = 0; operation fetch() returns int { wait 1ms; return 7; }';
    assert.equal((await stale(base + ' operation f() { values[cursor] = fetch(); } schedule { on start f(); }')).length, 1, 'the index was read before the right side suspended');
    assert.equal((await stale(base + ' operation f() { var i: int = cursor; wait 1ms; values[i] = 1; } schedule { on start f(); }')).length, 1, 'an index derived before a suspension');
    assert.equal((await stale(base + ' operation f() { var v: int = values[0]; wait 1ms; values[1] = v; } schedule { on start f(); }')).length, 1, 'a value read before a suspension');
    assert.equal((await stale(base + ' operation f() { wait 1ms; values[cursor] = values[0] + 1; } schedule { on start f(); }')).length, 0, 'everything read after resuming');
    assert.equal((await stale(base + ' operation f() { var v: int = fetch(); values[cursor] = v; } schedule { on start f(); }')).length, 0, 'the index is read after the suspension');
    assert.equal((await stale(base + ' operation f() { var local: int[3] = values; wait 1ms; local[0] = 1; values = local; } schedule { on start f(); }')).length, 1, 'a local root keeps its pre-suspension derivation');
});

test('values are copies: a read yields a copy and a place write never aliases (WP1-S02, WP1-R04)', async () => {
    const r = await run(wrap(`attribute fleet: Fleet = ${fleet}; attribute snapshot: Log = ${log('s')}; attribute ok: bool = false;
      operation put(out o: Log) { o = fleet.logs[0]; o.statuses[0].occurrences = 9; }
      operation f() { snapshot = fleet.logs[1]; snapshot.statuses[2].confirmed = true; var copy: Fleet = fleet; copy.logs[0].tag = "copy"; var outLog: Log = snapshot; put(outLog);
        ok = not fleet.logs[1].statuses[2].confirmed and fleet.logs[0].tag == "a" and copy.logs[0].tag == "copy" and outLog.statuses[0].occurrences == 9 and fleet.logs[0].statuses[0].occurrences == 0; }
      schedule { on start f(); }`));
    assert.equal(r.stores.Demo.ok, true);
    assert.equal((r.stores.Demo.snapshot as { statuses: { confirmed: boolean }[] }).statuses[2].confirmed, true);
});

test('concurrent activations read selectors from their dispatch snapshot and cannot write places (WP1-S05, WP1-R04)', async () => {
    const r = await run(`package Test { datatype Status { confirmed: bool; occurrences: int; } port def P { provides event value(v: int); }
      component def Source { attribute statuses: Status[2] = [record Status { confirmed = false; occurrences = 1; }, record Status { confirmed = false; occurrences = 2; }]; port p: P;
        operation watch() { wait 5ms; publish p.value(statuses[1].occurrences); }
        operation change() { wait 1ms; statuses[1].occurrences = 70; }
        schedule { on start watch() concurrent; on start change(); } }
      component def Sink { reversed port p: P; attribute n: int = 0; operation take(v: int) { n = v; } schedule { on receive p.value(v) take(v); } }
      component Demo { component source: Source; component sink: Sink; connect (source.p, sink.p); } }`);
    assert.equal(r.stores['Demo.sink'].n, 2);
    assert.equal((r.stores['Demo.source'].statuses as { occurrences: number }[])[1].occurrences, 70);
    await invalid(wrap(`attribute statuses: Status[3] = ${statuses}; operation f() { statuses[0].confirmed = true; } schedule { on start f() concurrent; }`), 'SW2006');
});

test('case scripts assign places rooted in their own locals and on call out bindings (WP1-S05)', async () => {
    const source = `package Bench {
  datatype Reading { value: int; flags: bool[2]; }
  port def Probe { provides operation sample(out r: Reading); }
  component def Unit { port probe: Probe reversed; attribute last: int = 0;
    operation poll() { var r: Reading = record Reading { value = 0; flags = [false, false]; }; probe.sample(r); last = r.value + (if1(r.flags[1])); }
    operation if1(b: bool) returns int { if (b) { return 100; } return 0; }
    schedule { on start poll(); } }
  component def Sensor { port probe: Probe; }
  component unit: Unit;
  component sensor: Sensor;
  connect (unit.probe, sensor.probe);
  test Sampled of unit {
    var readings: Reading[2] = [record Reading { value = 1; flags = [false, false]; }, record Reading { value = 2; flags = [false, false]; }];
    readings[1].flags[1] = true;
    on call sensor.probe.sample(r) { r = readings[0]; r.value = readings[1].value + 40; r.flags[1] = readings[1].flags[1]; }
    wait 1ms;
    assert unit.last == 142;
  }
  associate sensor to Sampled;
}`.replace('port probe: Probe reversed;', 'reversed port probe: Probe;');
    const r = await valid(source);
    const result = runCase([r.model], 'Bench::Sampled', { untilNs: 2000000 });
    assert.equal(result.result, 'pass', result.message);
    const place = writes(result.run!.trace).filter(w => w.place).map(w => [w.subject, w.place]);
    assert.deepEqual(place, [['Bench::Sampled.readings', 'readings[1].flags[1]'], ['Bench::Sampled.r', 'r.value'], ['Bench::Sampled.r', 'r.flags[1]']]);
    // WP1-S07 WP1-D02: an on call out binding is a place root, or read with selectors, only after a whole assignment.
    for (const [body, message] of [
        ['r.value = 5;', 'Out binding r must be assigned before r.value is assigned.'],
        ['r.value = r.value + 1;', 'Out binding r must be assigned before r.value is assigned.'],
        ['if (true) { r = readings[0]; } r.flags[0] = true;', 'Out binding r must be assigned before r.flags[0] is assigned.'],
    ]) {
        const found = (await parse(source.replace('{ r = readings[0]; r.value = readings[1].value + 40; r.flags[1] = readings[1].flags[1]; }', `{ ${body} }`))).errors.map(e => [e.code, e.message]);
        assert.ok(found.some(([code, m]) => code === 'SW2006' && m === message), body + ' ' + JSON.stringify(found));
    }
    // 2.2 forms keep their 2.2 rules: an empty handler and a 2.2 read of an unassigned binding stay valid.
    for (const body of ['', 'var v: int = r.value; r = readings[0];'])
        await valid(source.replace('{ r = readings[0]; r.value = readings[1].value + 40; r.flags[1] = readings[1].flags[1]; }', `{ ${body} }`));
});

test('an unassigned out value read through a field is the runtime failure Type, not a host error (review F2)', async () => {
    // A 2.2 source: the handler leaves its out binding unassigned and the caller reads a field of the reply.
    const source = `package Bench {
  datatype Reading { value: int; flags: bool[2]; }
  port def Probe { provides operation sample(out r: Reading); }
  component def Unit { reversed port probe: Probe; attribute last: int = 0;
    operation poll() { var r: Reading = record Reading { value = 0; flags = [false, false]; }; probe.sample(r); last = r.value; }
    schedule { on start poll(); } }
  component def Sensor { port probe: Probe; }
  component unit: Unit;
  component sensor: Sensor;
  connect (unit.probe, sensor.probe);
  test Unanswered of unit {
    on call sensor.probe.sample(r) { }
    wait 1ms;
    assert unit.last == 0;
  }
  associate sensor to Unanswered;
}`;
    const r = await valid(source);
    const result = runCase([r.model], 'Bench::Unanswered', { untilNs: 2000000 });
    const failure = result.run!.trace.find(t => t.kind === 'failure') as unknown as { subject: string; reason: string } | undefined;
    assert.deepEqual([failure?.subject, failure?.reason], ['unit.poll', 'Type']);
    assert.equal(result.run!.stores.unit.last, 0);
});

// ---------------------------------------------------------------- tools

test('WP1-M03 the formatter prints places and selectors without spaces inside the path', async () => {
    const services = createSwamlServices(EmptyFileSystem), source = `package Test { datatype S { f: int; } component def D { attribute a : S [ 2 ] = [ record S { f = 1; }, record S { f = 2; } ] ; operation f ( ) { var i : int = 0 ; a [ i ] . f = a [ 1 ] . f + 1 ; a [ 0 ] = a [ i ] ; } } }`;
    const doc = await parseHelper<a.Model>(services.Swaml)(source);
    const formatted = formatDocument(doc);
    assert.ok(formatted.includes('a[i].f = a[1].f + 1;'), formatted);
    assert.ok(formatted.includes('a[0] = a[i];'), formatted);
    const again = await parseHelper<a.Model>(services.Swaml)(formatted);
    assert.equal(formatDocument(again), formatted);
});

test('WP1-M02 the KerML inventory maps Selector as a value that lowers to a whole-value write of its root', () => {
    const mapping = JSON.parse(readFileSync(new URL('../../../spec/kerml-mapping.json', import.meta.url), 'utf8')) as { mapping: { source: string; kind: string; kernel: string[]; normative: string; semantic: string }[] };
    const selector = mapping.mapping.find(m => m.source === 'Selector')!;
    assert.deepEqual([selector.kind, selector.kernel, selector.normative], ['value', ['Expression'], 'docs/spec/01-structure-and-types.md']);
    assert.match(selector.semantic, /whole-value write of its root/u);
});

test('rename and references follow place roots, record fields in places and selectors, and indexed parts', async () => {
    const services = createSwamlServices(EmptyFileSystem);
    const source = twins('backend.twins[1].join(7); var v: Snapshot = backend.twins[1].currentView(); v.ids[1] = backend.twins[0].snapshot.ids[0]; assert v.speed == backend.twins[2].snapshot.speed;');
    const doc = services.shared.workspace.LangiumDocumentFactory.fromString(source, URI.parse('memory:///fleet.swaml'));
    services.shared.workspace.LangiumDocuments.addDocument(doc);
    await services.shared.workspace.DocumentBuilder.build([doc], { validation: true });
    const refs = semanticIndex([doc.parseResult.value as a.Model]).filter(r => !r.declaration);
    const at = (name: string) => refs.filter(r => r.symbol.name === name).map(r => source.slice(doc.textDocument.offsetAt(r.range.start), doc.textDocument.offsetAt(r.range.end)));
    assert.deepEqual(at('ids'), ['ids', 'ids', 'ids', 'ids']);
    assert.deepEqual(at('speed'), ['speed', 'speed', 'speed']);
    assert.deepEqual(at('snapshot'), ['snapshot', 'snapshot', 'snapshot', 'snapshot']);
    assert.deepEqual(at('twins'), ['twins', 'twins', 'twins', 'twins']);
    assert.ok(at('v').length >= 2);
});

test('places and selectors run in the simulate API and keep 2.2 forms unchanged (WP1-T01)', async () => {
    const r = await valid(wrap('attribute xs: int[2] = [1, 2]; attribute n: int = 0; operation f() { n = xs[1]; xs = [3, 4]; } schedule { on start f(); }'));
    const result = simulate([r.model], 'Test::Demo', { untilNs: 1000 });
    assert.ok(writes(result.trace).every(w => !('place' in w)), '2.2 forms add no place field');
    assert.deepEqual(result.stores.Demo, { xs: [3, 4], n: 2 });
});

test('WP1-D04 WP1-D06 messages name the failing segment and print literal indexes as written (review F5)', async () => {
    const found = await errors(twins('assert backend.twins[0].missing;'));
    assert.ok(found.some(([c, m]) => c === 'SW2002' && String(m).startsWith('Unknown value backend.twins[0].missing: backend.twins[0] has no attribute or part missing;')), JSON.stringify(found));
    const nested = await errors(twins('assert backend.twins[0].link;').replace('component def Backend { component twins: Twin[3]; component single: Twin; }', 'component def Row { component cells: Twin[2]; } component def Backend { component twins: Twin[3]; component single: Twin; component grid: Row[2]; }').replace('assert backend.twins[0].link;', 'assert backend.grid[1].cells.link;'));
    assert.ok(nested.some(([c, m]) => c === 'SW2002' && String(m).startsWith('Unknown value backend.grid[1].cells.link: backend.grid[1].cells is a part family and takes a literal index;')), JSON.stringify(nested));
    const huge = await errors(wrap('attribute a: int[3] = [1, 2, 3]; attribute s: Status[3] = ' + statuses + '; operation f() { s[9007199254740993].confirmed = true; } schedule { on start f(); }'));
    assert.ok(huge.some(([c, m]) => c === 'SW2002' && m === 'Index 9007199254740993 is outside Test::Status[3].'), JSON.stringify(huge));
    const call = await errors(twins('backend.twins[9007199254740993].join(1);'));
    assert.ok(call.some(([c, m]) => c === 'SW2002' && m === 'Index 9007199254740993 is outside the multiplicity 3 of backend.twins.'), JSON.stringify(call));
});

test('WP1-R04 a read takes its root first, then evaluates and applies each selector in turn; a place reads its root last (review F4)', async () => {
    const r = await run(wrap(`attribute a: int[3] = [1, 2, 3]; attribute ss: Status[2] = [record Status { confirmed = false; occurrences = 1; }, record Status { confirmed = false; occurrences = 2; }];
      attribute read1: int = 0; attribute read2: int = 0;
      operation reset() returns int { a = [10, 20, 30]; return 0; }
      operation bump() returns int { ss[0].occurrences = 50; return 0; }
      operation f() { read1 = a[reset()]; read2 = ss[bump()].occurrences; a[reset()] = 7; }
      schedule { on start f(); }`));
    // The reads saw the roots as they were before their index calls wrote them; the place saw the write.
    assert.deepEqual([r.stores.Demo.read1, r.stores.Demo.read2, r.stores.Demo.a], [1, 1, [7, 20, 30]]);
});
