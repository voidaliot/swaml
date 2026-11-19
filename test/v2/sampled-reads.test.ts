// WP6 of swa.ml 3.0: sampled reads of required attributes and per-member communication policies (ADR 0024), and the
// completion-guard warning revisited (WP5 review N2, N3): WP6-G01, WP6-G02, WP6-S01..S09, WP6-R01..R07, WP6-D01..D10,
// WP6-T01, WP6-M01..M05.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, TextDocument } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { attributeAccess, body, effectiveQos, effects, memberQos, sampledMembers } from '../../src/language/semantic.js';
import { runCase, simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, run, valid } from './helpers.js';
import { semanticIndex } from '../../src/language/path-services.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const errors = async (source: string) => (await parse(source)).errors.map(e => [String(e.code), String(e.message)]);
const warnings = async (source: string) => (await parse(source)).warnings.map(e => [String(e.code), String(e.message)]);
const kinds = (trace: Observation[], kind: string) => trace.filter(o => o.kind === kind);

/**
 * A sensor that sends ajar and count every 10 ms (n = 1, 2, ...) and a reader with the given members. The port
 * definition opts in to sampling when one of its attributes declares an initial value.
 */
const door = (reader: string, port = 'provides attribute ajar: bool = false; provides attribute count: int = 7;', more = '') => `package Test {
  port def Door { ${port} }
  component def Sensor { port out: Door; attribute n: int = 0; operation tick() { n = n + 1; send out.ajar(n % 2 == 1); send out.count(n); } schedule { on every 10ms tick(); } }
  component def Reader { reversed port door: Door; attribute seen: bool = false; attribute total: int = 0; attribute got: int = 0; attribute peeked: bool = false; operation peek() { peeked = door.ajar; } ${reader} }
  ${more}
  component Demo { component s: Sensor; component r: Reader; connect (s.out, r.door); }
}`;
const samples = (trace: Observation[]) => kinds(trace, 'sample').map(o => [o.timeNs, o.member, o.value]);
const reads = 'operation read() { seen = door.ajar; total = total + door.count; } schedule { on every 10ms read(); }';

test('WP6-G01 WP6-G02 initial values and member-policy bodies parse with their AST shapes', async () => {
    const { model } = await valid(`package Test {
  import Swaml::Qos;
  qos def Fast: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides attribute level: int = 3; provides event e(n: int); }
  component def S { port out: P; operation tick() { send out.level(1); publish out.e(1); } schedule { on every 1ms tick(); } }
  component def R { reversed port p: P; attribute k: int = 0; operation handle(n: int) { k = n + p.level; } schedule { on receive p.e(n) handle(n); } }
  component Demo { component s: S; component r: R; connect link (s.out, r.p) { e: Fast /** Events queue. */; } }
}`);
    const pkg = model.packages[0], port = pkg.elements.find(a.isPortDef)!, link = pkg.elements.find(a.isComponentUsage)!.members.find(a.isConnect)!;
    assert.equal(port.members[0].initial?.$type, 'Literal');
    assert.equal(port.members[1].initial, undefined);
    assert.deepEqual(link.memberPolicies.map(m => [m.member, m.policy.ref?.name, !!m.documentation]), [['e', 'Fast', true]]);
    assert.equal(memberQos(link, 'e').capacity, 2);
    assert.deepEqual(memberQos(link, 'level'), effectiveQos(link), 'the connection policy (here Default) for a member without a member policy');
    // A body needs at least one member policy; an event member has no initial value.
    assert.ok((await parse('package Test { component def C { connect (a.x, b.y) { } } }')).doc.parseResult.parserErrors.length);
    assert.ok((await parse('package Test { port def P { provides event e() = 1; } }')).doc.parseResult.parserErrors.length);
});

test('WP6-G02 an unfinished member policy projects, validates, indexes and builds view candidates without throwing, alone and beside a valid file (review F4)', async () => {
    const { viewCandidates } = await import('../../src/language/presentation.js');
    const { semanticIndex } = await import('../../src/language/path-services.js');
    const { workspace } = await import('./helpers.js');
    const source = (link: string) => `package Test {
  import Swaml::Qos;
  qos def Fast: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides event e(n: int); provides attribute a: int = 0; }
  component def S { port out: P; operation tick() { publish out.e(1); send out.a(1); } schedule { on every 1ms tick(); } }
  component def R { reversed port p: P; attribute k: int = 0; operation handle(n: int) { k = n + p.a; } schedule { on receive p.e(n) handle(n); } }
  component def Box { component s: S; component r: R; ${link} }
  component Demo { component s: S; component r: R; ${link} }
}`;
    // The valid file specializes the unfinished file's Box, so its validation walks the inherited connection.
    const other = 'package V { import Test; component def D specializes Box { } component def W { attribute b: int = 0; } }';
    for (const body of ['{ e: ; }', '{ : Fast; }', '{ e }', '{ e', '{ e: Fast;', '{ e Fast; }', '{ }', '{ /** d */ }', '{ e: Fast; a: ; }']) {
        const link = `connect (s.out, r.p) ${body}`, r = await parse(source(link));
        assert.ok(r.errors.length && r.errors.every(e => e.code === 'SW2000'), `${body}: ${JSON.stringify(r.errors.map(e => [e.code, e.message]))}`);
        // An unfinished member policy is left out of the labels; a complete one beside it is kept.
        const labels = projectModel([r.model]).edges.flatMap(e => (e.memberPolicies ?? []).map(m => [m.member, m.policy]));
        assert.ok(labels.every(([member, policy]) => member === 'e' && policy === 'Fast'), `${body}: ${JSON.stringify(labels)}`);
        assert.ok(viewCandidates([r.model]).length > 0, body);
        semanticIndex([r.model]);
        assert.throws(() => simulate([r.model], 'Test::Demo', { untilNs: 1000000 }), (e: Error) => !(e instanceof TypeError), body);
        const ws = await workspace([source(link), other]), models = ws.docs.map(d => d.parseResult.value as Model);
        assert.deepEqual(ws.docs[1].diagnostics?.filter(d => d.severity === 1).map(d => d.code), [], body);
        projectModel(models);
        viewCandidates(models);
        semanticIndex(models);
    }
});

test('WP6-S02 WP6-D04 an initial value is assignable to the member type and pure (the initializer messages)', async () => {
    assert.deepEqual(await errors('package Test { port def P { provides attribute a: bool = 3; } }'), [['SW2002', 'Expected bool, received int.']]);
    assert.deepEqual(await errors('package Test { operation def f() returns int { return 1; } port def P { provides attribute a: int = f() + 1; } }'), []);
    assert.deepEqual(await errors('package Test { import Swaml::Time; port def P { provides attribute a: uint = now(); } }'), [['SW2006', 'Initializer of a must be pure; now() reads state.']]);
    assert.deepEqual(await errors('package Test { component def C { port p { provides attribute a: int = x; } } }'), [['SW2002', 'Unknown local value x; nested operations never capture enclosing locals and component attributes are private.']]);
    // Reported once where the member is declared, not once per port usage.
    assert.equal((await errors('package Test { port def P { provides attribute a: bool = 3; } component def A { port x: P; port y: P; } }')).filter(([c]) => c === 'SW2002').length, 1);
});

test('WP6-S01 a sampled read in an operation body, a receive guard, a completion guard, a timer guard and a computed wait is valid', async () => {
    await valid(door(reads));
    await valid(door('operation read() { var c: int = door.count; got = c; } operation take(v: int) { got = v; } schedule { on every 10ms read(); }'));
    await valid(door('operation m() { state A { after 1ms { if (door.ajar) exit; } if (door.count > 2) exit; } state B { } } schedule { on start m(); }'));
    await valid(door('operation m() { wait (door.count * 1ms); got = 1; } schedule { on start m(); }'));
    // A record member: fields after the member; an array member: an index after it.
    await valid(`package Test {
  datatype Pos { x: int; y: int; }
  port def P { provides attribute pos: Pos = record Pos { x = 1; y = 2; }; provides attribute v: int[3] = [1, 2, 3]; }
  component def S { port out: P; operation t() { send out.pos(record Pos { x = 3; y = 4; }); send out.v([4, 5, 6]); } schedule { on every 1ms t(); } }
  component def R { reversed port p: P; attribute k: int = 0; operation r() { k = p.pos.x + p.v[2]; } schedule { on every 1ms r(); } }
  component Demo { component s: S; component r: R; connect (s.out, r.p); }
}`);
});

test('WP6-S01 WP6-S03 the opt-in is per member: a member without an initial value keeps its 2.2 diagnostics beside one that opts in (owner decision A)', async () => {
    const countOnly = 'operation read() { total = total + door.count; } schedule { on every 10ms read(); }';
    const unknown = ['SW2002', 'Unknown local value door.count; nested operations never capture enclosing locals and component attributes are private.'];
    const count22 = [unknown, ['SW2002', 'Arithmetic needs compatible numbers.'], ['SW2005', 'door.count needs exactly one input owner.']];
    assert.deepEqual(await errors(door(countOnly, 'provides attribute ajar: bool = false; provides attribute count: int;')), count22);
    // The same diagnostics as on a port where no member opts in (here peek's door.ajar is a 2.2 error too).
    assert.deepEqual((await errors(door(countOnly, 'provides attribute ajar: bool; provides attribute count: int;'))).filter(([, m]) => !m.includes('ajar')), count22);
    // The provider side's initial value has no runtime meaning: the reader's own declaration decides.
    const split = `package Test {
  port def Out { provides attribute level: int = 5; provides attribute ready: bool; }
  port def In { requires attribute level: int; requires attribute ready: bool = false; }
  component def S { port out: Out; operation t() { send out.level(1); send out.ready(true); } schedule { on every 1ms t(); } }
  component def R { port p: In; attribute k: int = 0; attribute up: bool = false; operation r() { k = p.level; up = p.ready; } schedule { on every 1ms r(); } }
  component Demo { component s: S; component r: R; connect (s.out, r.p); }
}`;
    assert.deepEqual(await errors(split), [['SW2002', 'Unknown local value p.level; nested operations never capture enclosing locals and component attributes are private.'], ['SW2005', 'p.level needs exactly one input owner.']]);
});

// Review F1: the redefined port is the one the occurrence has, so an inherited read is checked against it.
const redefined = (derived: string, own = 'on receive door.ajar(v) take(v);') => `package Test {
  port def D23 { provides attribute ajar: bool = false; }
  port def D23b { provides attribute ajar: bool = true; }
  port def D22 { provides attribute ajar: bool; }
  component def Sensor22 { port out: D22; attribute n: int = 0; operation tick() { n = n + 1; send out.ajar(n % 2 == 1); } schedule { on every 10ms tick(); } }
  component def Leaf { reversed port p: D23; attribute k: bool = false; operation r() { k = p.ajar; } schedule { on every 10ms r(); } }
  component def Base { reversed port door: D23; attribute seen: bool = false; attribute got: bool = false; attribute first: bool = false;
    operation read() { seen = door.ajar; } operation take(v: bool) { got = v; } operation begin() { first = door.ajar; }
    schedule { on start begin(); on every 10ms read(); ${own} } }
  ${derived}
}`;
test('WP6-S03 WP6-D02 a port redefinition that removes the initial value of a member inherited behaviour samples is SW2004 at the redefinition (review F1)', async () => {
    const message = 'Sampled attribute ajar of D22 needs an initial value: inherited read samples door.ajar.';
    const definition = 'component def Derived specializes Base { redefines reversed port door: D22; } ' +
        'component Demo { component s: Sensor22; component r: Derived; connect (s.out, r.door); }';
    assert.deepEqual(await errors(redefined(definition)), [['SW2004', message]]);
    // A usage redefinition, a redefinition two levels up and a member without a consuming owner: the same single error.
    assert.deepEqual(await errors(redefined('component Demo { component s: Sensor22; component r: Base { redefines reversed port door: D22; } connect (s.out, r.door); }')), [['SW2004', message]]);
    assert.deepEqual(await errors(redefined(definition.replace('component def Derived specializes Base {', 'component def Mid specializes Base {') + ' component def Derived specializes Mid { }')), [['SW2004', message]]);
    assert.deepEqual(await errors(redefined(definition, '')), [['SW2004', message]]);
    // A redefinition that changes the initial value is valid; the cell starts with the value of the port the occurrence has.
    const changed = await valid(redefined('component def Derived specializes Base { redefines reversed port door: D23b; } ' +
        'component Demo { component s: Sensor22; component r: Derived; connect (s.out, r.door); }', ''));
    const r = simulate([changed.model], 'Test::Demo', { untilNs: 5000000 });
    assert.deepEqual([r.stores['Demo.r'], r.trace.filter(o => o.kind === 'failure')], [{ seen: false, got: false, first: true }, []]);
    // A forwarding-compatible redefinition may widen int to real; the inherited read was typed int, so it would fail at run time.
    const widened = `package Test {
  port def DI { provides attribute count: int = 7; }
  port def DR { provides attribute count: real = 7.5; }
  component def Sensor { port out: DR; operation tick() { send out.count(2.5); } schedule { on every 10ms tick(); } }
  component def Base { reversed port door: DI; attribute total: int = 0; operation read() { total = door.count + 1; } schedule { on every 10ms read(); } }
  component def Derived specializes Base { redefines reversed port door: DR; }
  component Demo { component s: Sensor; component r: Derived; connect (s.out, r.door); }
}`;
    assert.deepEqual(await errors(widened), [['SW2004', 'Sampled attribute count of DR must keep type int: inherited read samples door.count.']]);
    // A derived forwarding of the inherited port is SW2005 at the forwarding (WP6-D01).
    assert.deepEqual(await errors(redefined('component def Derived specializes Base { component leaf: Leaf; connect (door, leaf.p); } ' +
        'component Demo { component s: Sensor22; component r: Derived; connect (s.out, r.door); }', '')),
        [['SW2005', 'door.ajar cannot be sampled: door is a forwarded boundary; inherited read samples it.']]);
    // A derived component that redefines the reading operations inherits no read of them: only the reads it still inherits count (review V2).
    assert.deepEqual(await errors(redefined('component def Derived specializes Base { redefines reversed port door: D22; redefines operation read() { seen = true; } redefines operation begin() { first = true; } } ' +
        'component Demo { component s: Sensor22; component r: Derived; connect (s.out, r.door); }')), []);
    // An inherited schedule entry's argument is checked where it is declared: only the SW2004 at the redefinition, no SW2002 in the valid base (review V1).
    const scheduled = `package Test {
  port def D23 { provides attribute ajar: bool = false; }
  port def D22 { provides attribute ajar: bool; }
  component def Sensor22 { port out: D22; operation tick() { send out.ajar(true); } schedule { on every 10ms tick(); } }
  component def SA { reversed port door: D23; attribute seen: bool = false; operation take(v: bool) { seen = v; } schedule { on every 10ms take(door.ajar); } }
  component def SAD specializes SA { redefines reversed port door: D22; }
  component Demo { component s: Sensor22; component r: SAD; connect (s.out, r.door); }
}`;
    assert.deepEqual(await errors(scheduled), [['SW2004', 'Sampled attribute ajar of D22 needs an initial value: an inherited schedule entry samples door.ajar.']]);
});

test('WP6-S08 WP6-D01 WP6-D05 forbidden ports, members and positions', async () => {
    const e = async (reader: string) => (await errors(door(reader))).filter(([c]) => c !== 'SW2005');
    // An unknown member declares no initial value, so it keeps its 2.2 message (owner decision A).
    assert.deepEqual(await e('operation read() { seen = door.nothing; } schedule { on every 10ms read(); }'), [['SW2002', 'Unknown local value door.nothing; nested operations never capture enclosing locals and component attributes are private.']]);
    assert.deepEqual(await e('attribute x: bool = door.ajar;'), [['SW2006', 'A sampled read is not allowed in an initializer.']]);
    assert.deepEqual(await e('operation read() { var y: int = 0; } schedule { on every (door.count * 1ms) read(); }'), [['SW2007', 'A sampled read is not allowed in a constant duration.']]);
    // A provided attribute or an event of an opted-in port is not a required attribute.
    const provided = (await errors(door('port back: Door; operation read() { seen = back.ajar; total = door.count; } operation t() { send back.ajar(true); send back.count(1); } schedule { on every 10ms read(); on every 10ms t(); }'))).filter(([c]) => c !== 'SW2004' && c !== 'SW2005');
    assert.deepEqual(provided, [['SW2006', 'back.ajar is not a required attribute of an owned port.']]);
    // A forwarded boundary is never sampled (SW2005).
    const forwarded = `package Test {
  port def P { provides attribute level: int = 0; }
  component def S { port out: P; operation t() { send out.level(1); } schedule { on every 1ms t(); } }
  component def Leaf { reversed port p: P; attribute k: int = 0; operation r() { k = p.level; } schedule { on every 1ms r(); } }
  component def Box { reversed port p: P; component leaf: Leaf; attribute k: int = 0; connect (p, leaf.p); operation r() { k = p.level; } schedule { on every 1ms r(); } }
  component Demo { component s: S; component b: Box; connect (s.out, b.p); }
}`;
    assert.deepEqual((await errors(forwarded)).filter(([c]) => c === 'SW2005' && c.length), [['SW2005', 'p.level cannot be sampled: p is a forwarded boundary.']]);
    // A child's port remains an error with its 2.2 diagnostic.
    const child = forwarded.replace('operation r() { k = p.level; } schedule { on every 1ms r(); } }\n  component Demo', 'operation r() { k = leaf.p.level; } schedule { on every 1ms r(); } }\n  component Demo').replace('connect (p, leaf.p); operation r() { k = p.level; }', 'connect (p, leaf.p); operation r() { k = leaf.p.level; }');
    assert.ok((await errors(child)).some(([c, m]) => c === 'SW2002' && m.startsWith('Unknown local value leaf.p.level')));
});

test('WP6-S09 WP6-D08 a case script does not sample; it keeps on receive', async () => {
    const source = door(reads, undefined, 'component def Probe { reversed port watch: Door; } component probe: Probe; component sensor: Sensor; connect (sensor.out, probe.watch); associate probe to T; test T of sensor { assert probe.watch.ajar; }').replace('component Demo { component s: Sensor; component r: Reader; connect (s.out, r.door); }', '');
    assert.deepEqual((await errors(source)).filter(([c]) => c === 'SW2010'), [['SW2010', 'A case script cannot sample watch.ajar; use on receive.']]);
});

test('WP6-S01 compatibility: p.m on a port without any initial value keeps its 2.2 diagnostics', async () => {
    const source = door(reads, 'provides attribute ajar: bool; provides attribute count: int;').replace('attribute peeked: bool = false; operation peek() { peeked = door.ajar; } ', '');
    const found = await errors(source);
    assert.deepEqual([...new Set(found.map(x => JSON.stringify(x)))].map(x => JSON.parse(x)), [
        ['SW2002', 'Unknown local value door.ajar; nested operations never capture enclosing locals and component attributes are private.'],
        ['SW2002', 'Unknown local value door.count; nested operations never capture enclosing locals and component attributes are private.'],
        ['SW2002', 'Arithmetic needs compatible numbers.'],
        ['SW2005', 'door.ajar needs exactly one input owner.'],
        ['SW2005', 'door.count needs exactly one input owner.'],
    ]);
});

// Review F2, F3, F6: a name hides a port only where the validator sees it, and every position the validator types as a
// sampled read has its cell.
const shadowing = (reader: string) => `package Test {
  datatype Rec { ajar: bool; count: int; }
  port def Door { provides attribute ajar: bool = false; provides attribute count: int = 7; }
  component def Sensor { port out: Door; attribute n: int = 0; operation tick() { n = n + 1; send out.ajar(n % 2 == 1); send out.count(n); } schedule { on every 10ms tick(); } }
  component def Reader { reversed port door: Door; attribute seen: bool = false; attribute total: int = 0; attribute got: int = 0; ${reader} }
  component Demo { component s: Sensor; component r: Reader; connect (s.out, r.door); }
}`;
const readerOf = (m: Model) => m.packages[0].elements.filter(a.isComponentDef).find(x => x.name === 'Reader')!;
test('WP6-S01 WP6-S04 a local hides the port only where it is visible: another branch, a nested parameter and an earlier local (review F2)', async () => {
    const peek = 'operation peek() { seen = door.ajar; }';
    const branch = `operation read(k: int) { if (k > 0) { got = door.count; } else { var door: int = 3; got = door; } } ${peek}`;
    for (const owner of ['operation take(v: int) { total = v; } schedule { on every 10ms read(1); on every 10ms peek(); on receive door.count(v) take(v); }', 'schedule { on every 10ms read(1); on every 10ms peek(); }']) {
        const { model } = await valid(shadowing(branch + ' ' + owner));
        assert.deepEqual([...sampledMembers(readerOf(model))].sort(), ['door.ajar', 'door.count']);
        // The read at 10 ms sees the initial value or the value delivered in the same instant, at 20 ms the value of 10 ms; never a run-time fault.
        const r = simulate([model], 'Test::Demo', { untilNs: 25000000 });
        assert.deepEqual([(r.stores['Demo.r'] as Record<string, number>).got, r.trace.filter(o => o.kind === 'failure').length], [1, 0], owner);
    }
    // A local declared later in the same block does not hide the port at an earlier read.
    const later = await valid(shadowing('operation read() { got = door.count; var door: int = 3; total = door; } operation peek() { seen = door.ajar; } schedule { on every 10ms read(); on every 10ms peek(); }'));
    assert.deepEqual([...sampledMembers(readerOf(later.model))].sort(), ['door.ajar', 'door.count']);
    // A for local named like the port does not hide it in its own initializer, only in the condition, update and body (review V2).
    const loop = await valid(shadowing('operation read() { for (var door: int = door.count; door < 9; door = door + 1) { total = door; } seen = door.ajar; } schedule { on every 10ms read(); }'));
    assert.deepEqual([...sampledMembers(readerOf(loop.model))].sort(), ['door.ajar', 'door.count']);
    assert.deepEqual(kinds(simulate([loop.model], 'Test::Demo', { untilNs: 5000000 }).trace, 'failure'), []);
    // A parameter of a nested operation hides nothing in the enclosing operation.
    const nested = await valid(shadowing('operation read() { operation inner(door: int) { } got = door.count; seen = door.ajar; } schedule { on every 10ms read(); }'));
    assert.deepEqual([...sampledMembers(readerOf(nested.model))].sort(), ['door.ajar', 'door.count']);
    // A local declared before the read hides the port: a record field read, not a sampled read, with its own owners.
    const local = await valid(shadowing('operation read() { var door: Rec = record Rec { ajar = true; count = 5; }; got = door.count; } operation take(v: int) { total = v; } operation t2(v: bool) { seen = v; } schedule { on every 10ms read(); on receive door.count(v) take(v); on receive door.ajar(v) t2(v); }'));
    assert.deepEqual([...sampledMembers(readerOf(local.model))], []);
    assert.equal((simulate([local.model], 'Test::Demo', { untilNs: 15000000 }).stores['Demo.r'] as Record<string, number>).got, 5);
});

test('WP6-S01 WP6-R03 a sampled read in a schedule-entry argument has its cell, with or without a consuming owner (review F3)', async () => {
    for (const owner of ['operation take(v: int) { total = v; } schedule { on every 10ms read(door.count); on every 10ms peek(); on receive door.count(v) take(v); }', 'schedule { on every 10ms read(door.count); on every 10ms peek(); }']) {
        const { model } = await valid(shadowing('operation read(v: int) { got = v; } operation peek() { seen = door.ajar; } ' + owner));
        assert.ok(sampledMembers(readerOf(model)).has('door.count'));
        const r = simulate([model], 'Test::Demo', { untilNs: 25000000 });
        assert.deepEqual([(r.stores['Demo.r'] as Record<string, number>).got, r.trace.filter(o => o.kind === 'failure').length], [1, 0], owner);
    }
    // A binding of a receive entry hides the port in that entry's arguments: door.count is then an unsampled member without an owner.
    const bound = await parse(shadowing('operation take(v: Rec) { got = v.count; } operation peek() { seen = door.ajar; total = door.count; } schedule { on every 10ms peek(); }').replace('component Demo', 'port def Recs { provides event rec(r: Rec); } component def Feed { port out: Recs; operation t() { publish out.rec(record Rec { ajar = true; count = 9; }); } schedule { on every 10ms t(); } } component def Box { reversed port inp: Recs; reversed port door: Door; attribute got: int = 0; attribute seen: bool = false; operation take(v: int) { got = v; } operation peek() { seen = door.ajar; } schedule { on receive inp.rec(door) take(door.count); on every 10ms peek(); } } component Demo'));
    assert.deepEqual(bound.errors.map(e => [e.code, e.message]), [['SW2005', 'door.count needs exactly one input owner.']]);
    assert.deepEqual([...sampledMembers(bound.model.packages[0].elements.filter(a.isComponentDef).find(x => x.name === 'Box')!)], ['door.ajar']);
});

test('WP6-S01 effect and access analysis ignore a port hidden by a parameter: the helper stays pure (review F6)', async () => {
    const { model } = await valid(shadowing('operation isOpen(door: Rec) returns bool { return door.ajar; } attribute init: bool = isOpen(record Rec { ajar = true; count = 1; }); operation read() { seen = door.ajar; got = door.count; } schedule { on every 10ms read(); }'));
    const reader = readerOf(model), isOpen = reader.members.filter(a.isOperation).find(x => x.name === 'isOpen')!, read = reader.members.filter(a.isOperation).find(x => x.name === 'read')!;
    assert.deepEqual([effects(isOpen, reader).reads, [...attributeAccess([body(isOpen)!], reader).cells]], [false, []]);
    assert.deepEqual([effects(read, reader).reads, [...attributeAccess([body(read)!], reader).cells].sort()], [true, ['door.ajar', 'door.count']]);
});

test('WP6-S04 WP6-D03 sampling is not ownership: zero or one consuming owner for a sampled member, exactly one otherwise', async () => {
    await valid(door(reads));
    await valid(door(reads.replace('schedule { on every 10ms read(); }', 'operation take(v: int) { got = v; } schedule { on every 10ms read(); on receive door.count(v) take(v); }')));
    const two = door(reads.replace('schedule { on every 10ms read(); }', 'operation take(v: int) { got = v; } operation also(v: int) { got = v; } schedule { on every 10ms read(); on receive door.count(v) take(v); on receive door.count(v) also(v); }'));
    assert.deepEqual(await errors(two), [['SW2005', 'door.count needs exactly one input owner.']]);
    // An unsampled required attribute of an opted-in port still needs its owner.
    assert.deepEqual(await errors(door('operation read() { seen = door.ajar; } schedule { on every 10ms read(); }')), [['SW2005', 'door.count needs exactly one input owner.']]);
    const { model } = await parse(door(reads));
    assert.deepEqual([...sampledMembers(model.packages[0].elements.filter(a.isComponentDef)[1])], ['door.ajar', 'door.count']);
});

const policies = (body: string, connect: string, extra = '') => `package Test {
  import Swaml::Qos;
  qos def Fast: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  qos def Sure: Policy { delivery = Delivery.atLeastOnce; ordering = Ordering.fifo; capacity = 4; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides event e(n: int); requires operation get() returns int; }
  component def S { port out: P; operation t() { publish out.e(1); } schedule { on every 1ms t(); } ${body} }
  component def R { reversed port p: P; attribute k: int = 0; operation handle(n: int) { k = n; } operation get() returns int { return k; } schedule { on receive p.e(n) handle(n); on call p.get() get(); } }
  component def Box { reversed port p: P; component r: R; ${extra || 'connect (p, r.p);'} }
  component Demo { component s: S; component r: R; ${connect} }
}`;

test('WP6-S05 WP6-D06 member policies: not on forwarding, members of both ports, once per member; package connections may carry them', async () => {
    await valid(policies('', 'connect (s.out, r.p) { e: Fast; }'));
    assert.deepEqual(await errors(policies('', 'connect (s.out, r.p) { e: Fast; zz: Fast; }')), [['SW2004', "zz is not a member of both ports of connect (s.'out', r.p)."]]);
    assert.deepEqual(await errors(policies('', 'connect link (s.out, r.p) { e: Fast; e: Fast; }')), [['SW2004', 'e has two policies in link.']]);
    assert.deepEqual((await errors(policies('', 'connect (s.out, r.p);', 'connect fw (p, r.p) { e: Fast; }'))).filter(([c]) => c === 'SW2004'), [['SW2004', 'Member policies are not allowed on forwarding fw.']]);
    await valid(`package Test {
  import Swaml::Qos;
  qos def Fast: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides event e(n: int); }
  component def S { port out: P; operation t() { publish out.e(1); } schedule { on every 1ms t(); } }
  component def R { reversed port p: P; attribute k: int = 0; operation handle(n: int) { k = n; } schedule { on receive p.e(n) handle(n); } }
  component s: S;
  component r: R;
  connect (s.out, r.p) { e: Fast; }
}`);
});

test('WP6-S07 WP6-D07 completeness and idempotency apply per member route', async () => {
    // atLeastOnce through a member policy needs an idempotent provided operation; a member policy can also lift it.
    assert.deepEqual(await errors(policies('', 'connect (s.out, r.p) { get: Sure; }')), [['SW2013', 'atLeastOnce requires idempotent provided operation r.p.get.']]);
    assert.deepEqual(await errors(policies('', 'connect: Sure (s.out, r.p) { get: Fast; }')), []);
    assert.deepEqual(await errors(policies('', 'connect: Sure (s.out, r.p);')), [['SW2013', 'atLeastOnce requires idempotent provided operation r.p.get.']]);
    // A member policy names a qos def; an incomplete one is reported at the definition.
    assert.ok((await errors(policies('', 'connect (s.out, r.p) { e: Broken; }').replace('qos def Fast', 'qos def Broken: Policy { capacity = 2; } qos def Fast'))).some(([c, m]) => c === 'SW2013' && m.startsWith('A policy needs complete')));
});

test('WP6-S06 redefines connect replaces the whole connection with its member policies; nothing is merged', async () => {
    const source = (redefined: string) => `package Test {
  import Swaml::Qos;
  qos def One: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 1; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  qos def Many: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 8; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def P { provides event e(n: int); provides event f(n: int); }
  component def S { port out: P; operation t() { publish out.e(1); publish out.e(2); publish out.e(3); publish out.f(1); publish out.f(2); publish out.f(3); } schedule { on start t(); } }
  component def R { reversed port p: P; attribute es: int = 0; attribute fs: int = 0;
    operation m() { while (true) { state idle { on receive p.e(n) { es = es + 1; exit; } on receive p.f(n) { fs = fs + 1; exit; } } wait 1ms; } }
    schedule { on start m(); } }
  component def Base { component s: S; component r: R; connect link: One (s.out, r.p) { e: Many; } }
  component Demo: Base { ${redefined} }
}`;
    const stores = async (redefined: string) => (await run(source(redefined), 50000000)).stores['Demo.r'];
    // e1 is taken at once; e2, e3, f1, f2 and f3 stay queued while the machine is busy in its wait (SIF-R06; 2.2 and
    // WP5 kept them with a deferral in a waiting state, which drops them under SIF-R05). A capacity of 1 keeps only the newest.
    assert.deepEqual(await stores(''), { es: 3, fs: 1 }, 'inherited: e queues with Many, f keeps one with One');
    assert.deepEqual(await stores('redefines connect link: One (s.out, r.p) { f: Many; }'), { es: 2, fs: 3 }, 'the redefinition replaces e: Many');
    assert.deepEqual(await stores('redefines connect link: One (s.out, r.p);'), { es: 2, fs: 1 }, 'no member policy is inherited');
});

// SIF (proposal 4.4, 4.8, 7.3): three WP5/WP6 tests left with the forms they checked. 'WP6-S07 SW2018 uses the effective
// policy of the deferred member route': deferral never ships, and SW2018 is unused in 3.0.
// 'WP6-D10 (SW2017) a completion guard that folds to false is dead': completion transitions are gone and SIF has no
// warning for a dead condition. 'WP5-D08 WP6 SW2017 confirmed for sampled cells': under SIF-R07 a sample-cell update in
// a waiting state's read set makes it look again (wakes, package 4), so the warning and the stuck run are gone.

const timed = (sender: string, reader: string, options = {}, untilNs = 40000000) => run(door(reader).replace("operation tick() { n = n + 1; send out.ajar(n % 2 == 1); send out.count(n); } schedule { on every 10ms tick(); }", sender), untilNs, options);

test('WP6-R01 WP6-T01 the cell holds the initial value before startup work; a sample observation records each update', async () => {
    const r = await timed('operation tick() { n = n + 1; send out.ajar(true); send out.count(n); } schedule { on every 10ms tick(); }', 'operation first() { got = door.count; seen = door.ajar; } operation read() { total = door.count; } schedule { on start first(); on every 25ms read(); }');
    assert.deepEqual(r.stores['Demo.r'], { seen: false, total: 2, got: 7, peeked: false });
    const s = kinds(r.trace as Observation[], 'sample')[1];
    assert.deepEqual([s.subject, s.targetPort, s.member, s.value, typeof s.message, s.source], ['Demo.r.door.count', 'Demo.r.door', 'count', 1, 'string', 'Test::Sensor.tick/2']);
    assert.equal(kinds(r.trace as Observation[], 'deliver').length, 0, 'no consumer: no deliver (WP6-R04)');
    assert.equal(kinds(r.trace as Observation[], 'replaceAttribute').length, 0, 'no consumer: no pending value to replace (WP6-R04)');
});

test('WP6-R02 latency, drops, duplicates, fault delays and maxAge update the cell at each delivery instant', async () => {
    const sender = 'operation tick() { n = n + 1; send out.count(n); send out.ajar(true); } schedule { on every 10ms tick(); }', reader = 'operation read() { total = door.count; } schedule { on every 10ms read(); }';
    assert.deepEqual(samples((await timed(sender, reader, { latencyNs: 3000000 })).trace as Observation[]).filter(x => x[1] === 'count'), [[13000000, 'count', 1], [23000000, 'count', 2], [33000000, 'count', 3]]);
    // Offer 1 (count 1) dropped: no update. Offer 3 (count 2) duplicated: two updates. Offer 5 (count 3) delayed past offer 7 (count 4).
    // Offer 1 (count 1) is dropped: no update. Offer 3 (count 2) is duplicated, which atMostOnce (Default) suppresses.
    const faults = [{ offer: 1, kind: 'drop' }, { offer: 3, kind: 'duplicate' }];
    assert.deepEqual(samples((await timed(sender, reader, { faults })).trace as Observation[]).filter(x => x[1] === 'count'), [[20000000, 'count', 2], [30000000, 'count', 3], [40000000, 'count', 4]]);
    // A value older than maxAge at delivery is discarded and leaves the cell unchanged.
    const aged = door('attribute probe: int = 0; operation look() { probe = door.count; } schedule { on every 15ms look(); }', undefined, 'qos def Fresh: Swaml::Qos::Policy { delivery = Swaml::Qos::Delivery.atMostOnce; ordering = Swaml::Qos::Ordering.fifo; capacity = 4; overflow = Swaml::Qos::Overflow.dropOldest; requestTimeout = 1s; maxAge = 2ms; }').replace('connect (s.out, r.door);', 'connect: Fresh (s.out, r.door);');
    const old = await run(aged, 16000000, { latencyNs: 3000000 });
    assert.deepEqual([samples(old.trace as Observation[]).length, kinds(old.trace as Observation[], 'discardAge').length, (old.stores['Demo.r'] as Record<string, number>).probe], [0, 2, 7]);
    // A read after the dropped offer still sees the initial value.
    const dropped = await timed(sender, 'attribute probe: int = 0; operation look() { probe = door.count; } schedule { on every 15ms look(); }', { faults: [{ offer: 1, kind: 'drop' }] }, 16000000);
    assert.equal((dropped.stores['Demo.r'] as Record<string, number>).probe, 7);
    // With bestEffort each copy updates the cell at its own delivery instant.
    const best = door(reader, undefined, 'qos def Loose: Swaml::Qos::Policy { delivery = Swaml::Qos::Delivery.bestEffort; ordering = Swaml::Qos::Ordering.fifo; capacity = 4; overflow = Swaml::Qos::Overflow.dropOldest; requestTimeout = 1s; }')
        .replace("operation tick() { n = n + 1; send out.ajar(n % 2 == 1); send out.count(n); } schedule { on every 10ms tick(); }", sender).replace('connect (s.out, r.door);', 'connect: Loose (s.out, r.door);');
    const copies = await run(best, 25000000, { faults: [{ offer: 3, kind: 'duplicate' }] });
    assert.deepEqual(samples(copies.trace as Observation[]).filter(x => x[1] === 'count'), [[10000000, 'count', 1], [20000000, 'count', 2], [20000000, 'count', 2]]);
    assert.notEqual(kinds(copies.trace as Observation[], 'sample')[1].message, kinds(copies.trace as Observation[], 'sample')[2].message);
    const late = await run(door('operation read() { total = door.count; } schedule { on every 10ms read(); }').replace("operation tick() { n = n + 1; send out.ajar(n % 2 == 1); send out.count(n); } schedule { on every 10ms tick(); }", sender), 31000000, { faults: [{ offer: 3, kind: 'drop', delayNs: 15000000 }] });
    assert.deepEqual(samples(late.trace as Observation[]).filter(x => x[1] === 'count'), [[10000000, 'count', 1], [30000000, 'count', 3]]);
});

test('WP6-R02 a cell never goes back: a value offered before the one it holds does not update it (owner decision B, review F7)', async () => {
    const source = `package Test {
  import Swaml::Qos;
  qos def Once: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 4; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  port def Door { provides attribute count: int = 7; }
  component def Sensor { port out: Door; attribute n: int = 0; operation tick() { n = n + 1; send out.count(n); } schedule { on every 10ms tick(); } }
  component def Reader { reversed port door: Door; attribute total: int = 0; attribute got: int = 0; attribute late: int = 0;
    operation take(v: int) { got = v; total = door.count; } operation look() { late = door.count; } schedule { on receive door.count(v) take(v); on every 27ms look(); } }
  component Demo { component s: Sensor; component r: Reader; connect: Once (s.out, r.door); }
}`;
    // Offer 1 (count 1) is delayed by 15 ms to 25 ms, after offer 2 (count 2) was delivered at 20 ms; the owner consumed 2.
    const r = await run(source, 30000000, { faults: [{ offer: 1, kind: 'duplicate', delayNs: 15000000 }] });
    assert.deepEqual(samples(r.trace as Observation[]), [[20000000, 'count', 2], [30000000, 'count', 3]]);
    assert.deepEqual(r.stores['Demo.r'], { total: 3, got: 3, late: 2 }, 'at 27 ms the cell still holds the value the owner consumed');
    // A delayed value that nothing newer overtook still updates the cell at its delivery instant.
    const alone = await run(source, 18000000, { faults: [{ offer: 1, kind: 'duplicate', delayNs: 5000000 }] });
    assert.deepEqual(samples(alone.trace as Observation[]), [[15000000, 'count', 1]]);
});

test('WP6-R02 within an instant a read sees the updates ordered before it: the worked example in both orders', async () => {
    const source = (first: string) => `package Test {
  port def Level { provides attribute value: int = 0; }
  component def Producer { port out: Level; attribute n: int = 0; operation tick() { send out.value(n + 1); n = n + 1; } schedule { on every 20ms tick(); } }
  component def Consumer { reversed port level: Level; attribute seen: int = -1; attribute slots: int = 0; operation slot() { seen = level.value; if (level.value > 0) { slots = slots + 1; } } schedule { on every 20ms slot(); } }
  component Demo { ${first} connect (p.out, c.level); }
}`;
    const consumerFirst = (await run(source('component c: Consumer; component p: Producer;'), 40000000)).stores['Demo.c'];
    const producerFirst = (await run(source('component p: Producer; component c: Consumer;'), 40000000)).stores['Demo.c'];
    // One activation reads the same value in its guard-like test and its body (WP6-R03), although steps interleave.
    assert.deepEqual(consumerFirst, { seen: 1, slots: 1 }, 'consumer first: the previous value at 20 ms, the value of 20 ms at 40 ms');
    assert.deepEqual(producerFirst, { seen: 2, slots: 2 }, 'producer first: the new value in the same instant');
});

test('WP6-R03 reads are live: a read after a suspension sees the newer value', async () => {
    const r = await timed('operation tick() { n = n + 1; send out.count(n * 10); send out.ajar(true); } schedule { on every 10ms tick(); }',
        'attribute early: int = 0; attribute late: int = 0; operation read() { early = door.count; wait 12ms; late = door.count; } schedule { on every 15ms read(); }', {}, 29000000);
    // read at 15 ms sees the value of 10 ms; after its wait, at 27 ms, the value delivered at 20 ms.
    assert.deepEqual([(r.stores['Demo.r'] as Record<string, number>).early, (r.stores['Demo.r'] as Record<string, number>).late], [10, 20]);
});

test('WP6-R07 a concurrent entry reads attributes from its dispatch snapshot and sample cells live, also after resumption', async () => {
    const r = await run(`package Test {
  port def Level { provides attribute value: int = 0; }
  port def Report { provides event seen(v: int); }
  component def Producer { port out: Level; attribute n: int = 0; operation tick() { n = n + 1; send out.value(n * 10); } schedule { on every 10ms tick(); } }
  component def Watcher { reversed port level: Level; port rep: Report; attribute mark: int = 0;
    operation set() { mark = 100; }
    operation look() { wait 12ms; publish rep.seen(level.value + mark); }
    schedule { on every 15ms look() concurrent; on every 20ms set(); } }
  component def Sink { reversed port rep: Report; attribute first: int = -1; attribute last: int = -1; operation take(v: int) { if (first < 0) { first = v; } last = v; } schedule { on receive rep.seen(v) take(v); } }
  component Demo { component p: Producer; component w: Watcher; component k: Sink; connect (p.out, w.level); connect (w.rep, k.rep); }
}`, 45000000);
    // look at 15 ms resumes at 27 ms: the live cell (20, delivered at 20 ms) plus the snapshot mark 0, although set wrote 100
    // at 20 ms. look at 30 ms resumes at 42 ms: the live cell 40 plus its snapshot 100.
    assert.deepEqual(r.stores['Demo.k'], { first: 20, last: 140 });
});

test('WP6-R04 a consumed sampled member gives one sample and one deliver per value; replacement in the queue does not stop the cell', async () => {
    const r = await timed('operation tick() { n = n + 1; send out.count(n); send out.count(n + 100); send out.ajar(true); } schedule { on every 10ms tick(); }', 'operation take(v: int) { got = v; } operation read() { total = door.count; } schedule { on receive door.count(v) take(v); on every 10ms read(); }', { latencyNs: 1000000 });
    const t = r.trace as Observation[];
    assert.deepEqual(samples(t).filter(x => x[1] === 'count').slice(0, 2), [[11000000, 'count', 1], [11000000, 'count', 101]]);
    assert.equal(kinds(t, 'replaceAttribute').length >= 1, true);
    assert.equal(kinds(t, 'deliver').filter(o => o.timeNs === 11000000).length, 1);
    assert.equal((r.stores['Demo.r'] as Record<string, number>).got, 103, 'the queue keeps only the newest value, n + 100');
});

test('WP6-R05 each member route uses its effective policy: capacity, overflow and request timeout per member', async () => {
    const source = (body: string) => policies('', `connect: Fast (s.out, r.p) ${body}`).replace('schedule { on receive p.e(n) handle(n); on call p.get() get(); } }', 'operation m() { while (true) { state A { on receive p.e(n) { k = k + 1; exit; } } wait 5ms; } } schedule { on start m(); on call p.get() get(); } }').replace('operation handle(n: int) { k = n; } ', '').replace('operation t() { publish out.e(1); } schedule { on every 1ms t(); }', 'operation t() { publish out.e(1); publish out.e(2); publish out.e(3); publish out.e(4); var x: int = try(out.get(), 0); } schedule { on start t(); }');
    const fast = await run(source(';'), 30000000), many = await run(source('{ e: Sure; get: Sure; }').replace('requires operation get() returns int;', 'requires idempotent operation get() returns int;').replace('provides event e(n: int); requires', 'provides event e(n: int); requires'), 30000000);
    assert.equal((fast.stores['Demo.r'] as Record<string, number>).k, 3, 'Fast: capacity 2 keeps two retained events');
    assert.equal(kinds(fast.trace as Observation[], 'overflow').length, 1);
    assert.equal((many.stores['Demo.r'] as Record<string, number>).k, 4, 'the member policy Sure holds four');
});

test('WP6-R05 a request times out after the requestTimeout of its member policy, not of the connection policy (review F9)', async () => {
    const source = (connect: string) => `package Test {
  import Swaml::Qos;
  qos def Slow: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  qos def Quick: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1ms; }
  port def P { provides operation get(x: int) returns int; }
  component def S { port out: P; operation get(x: int) returns int { wait 5ms; return x; } schedule { on call out.get(x) get(x); } }
  component def R { reversed port p: P; attribute k: int = 0; operation run() { k = try(p.get(3), -1); } schedule { on start run(); } }
  component Demo { component s: S; component r: R; ${connect} }
}`;
    const quick = await run(source('connect: Slow (s.out, r.p) { get: Quick; }'), 20000000), slow = await run(source('connect: Slow (s.out, r.p);'), 20000000);
    assert.deepEqual([quick.stores['Demo.r'], kinds(quick.trace as Observation[], 'timeout').map(o => o.timeNs)], [{ k: -1 }, [1000000]]);
    assert.deepEqual([slow.stores['Demo.r'], kinds(slow.trace as Observation[], 'timeout').length], [{ k: 3 }, 0]);
});

test('WP6-R01 WP6-R02 forwarded boundaries and multiplicity families: the cell belongs to the sampling port occurrence', async () => {
    const r = await run(`package Test {
  port def P { provides attribute level: int = 5; }
  component def S { port out: P; attribute n: int = 0; operation t() { n = n + 1; send out.level(n); } schedule { on every 10ms t(); } }
  component def Leaf { reversed port p: P; attribute k: int = 0; operation r() { k = p.level; } schedule { on every 10ms r(); } }
  component def Box { reversed port p: P; component leaf: Leaf; connect (p, leaf.p); }
  component def Pair { port a: P; port b: P; attribute n: int = 0; operation t() { n = n + 1; send a.level(n); send b.level(n * 10); } schedule { on every 10ms t(); } }
  component def Many { reversed port x: P; reversed port y: P; component twins: Leaf[2]; connect (x, twins[0].p); connect (y, twins[1].p); }
  component Demo { component s: S; component box: Box; component pair: Pair; component many: Many; connect (s.out, box.p); connect (pair.a, many.x); connect (pair.b, many.y); }
}`, 25000000);
    assert.deepEqual([r.stores['Demo.box.leaf'], r.stores['Demo.many.twins[0]'], r.stores['Demo.many.twins[1]']].map(x => (x as Record<string, number>).k), [1, 1, 10]);
    assert.deepEqual(kinds(r.trace as Observation[], 'sample').map(o => o.subject).slice(0, 3), ['Demo.box.leaf.p.level', 'Demo.many.twins[0].p.level', 'Demo.many.twins[1].p.level']);
});

test('WP6-M01 WP6-M04 projections: member policies on their connection, initial values and sampled members; absent on 2.2 sources', async () => {
    const { model } = await valid(policies('', 'connect link: Fast (s.out, r.p) { get: Fast; }').replace('provides event e(n: int);', 'provides event e(n: int); provides attribute lvl: int = 4;').replace('component def S { port out: P; operation t() { publish out.e(1); }', 'component def S { port out: P; operation t() { publish out.e(1); send out.lvl(1); }').replace('attribute k: int = 0;', 'attribute k: int = 0; operation peek() { k = p.lvl; }').replace('on call p.get() get(); } }', 'on call p.get() get(); on every 1ms peek(); } }'));
    const projection = projectModel([model]);
    const edge = projection.edges.find(e => e.label === 'link')!;
    assert.deepEqual(edge.memberPolicies?.map(m => [m.member, m.policy, m.qos.capacity]), [['get', 'Fast', 2]]);
    const r = projection.nodes.find(n => n.id === 'Test::R')!;
    assert.deepEqual(r.sampled, ['p.lvl']);
    assert.equal(r.ports?.[0].members.find(m => m.name === 'lvl')?.initial, '4');
    const plain = projectModel([(await valid(policies('', 'connect (s.out, r.p);'))).model]);
    assert.ok(plain.edges.every(e => e.memberPolicies === undefined) && plain.nodes.every(n => n.sampled === undefined && (n.ports ?? []).every(p => p.members.every(m => m.initial === undefined))));
});

test('WP6-S01 WP6-S05 rename and references see sampled reads and member-policy names (review F5)', async () => {
    const source = `package Test {
  import Swaml::Qos;
  qos def Fast: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.dropOldest; requestTimeout = 1s; }
  datatype Pos { x: int; y: int; }
  port def Door { provides attribute ajar: bool = false; provides attribute pos: Pos = record Pos { x = 0; y = 0; }; provides event e(n: int); }
  component def Sensor { port out: Door; operation tick() { send out.ajar(true); send out.pos(record Pos { x = 1; y = 2; }); publish out.e(1); } schedule { on every 10ms tick(); } }
  component def Reader { reversed port door: Door; attribute seen: bool = false; attribute k: int = 0;
    operation read() { seen = door.ajar; k = door.pos.x; } operation h(n: int) { k = n; }
    schedule { on every 10ms read(); on receive door.e(n) h(n); } }
  component Demo { component s: Sensor; component r: Reader; connect (s.out, r.door) { e: Fast; ajar: Fast; } }
}`;
    const r = await valid(source), text = (x: { range: { start: { line: number; character: number }; end: { line: number; character: number } } }) => source.slice(r.doc.textDocument.offsetAt(x.range.start), r.doc.textDocument.offsetAt(x.range.end));
    const uses = (name: string, line: number) => semanticIndex([r.model]).filter(x => x.symbol.name === name && !x.declaration && x.range.start.line === line).map(text);
    assert.deepEqual(uses('door', 7), ['door', 'door'], 'the port in both sampled reads');
    assert.deepEqual(uses('ajar', 7), ['ajar']);
    assert.deepEqual([uses('pos', 7), uses('x', 7)], [['pos'], ['x']], 'the member and the record field after it');
    assert.deepEqual([uses('e', 9), uses('ajar', 9)], [['e'], ['ajar']], 'the member-policy names');
    const rename = async (needle: string, newName: string) => {
        const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(source.indexOf(needle)), newName });
        const changes = (edit?.documentChanges ?? []).flatMap(c => 'edits' in c ? c.edits : []);
        return TextDocument.applyEdits(TextDocument.create('memory:///x.swaml', 'swaml', 0, source), changes.map(e => ('newText' in e ? e : { range: e.range, newText: '' }) as { range: never; newText: string }));
    };
    const port = await rename('door: Door', 'gate');
    assert.match(port, /seen = gate\.ajar; k = gate\.pos\.x;/u);
    await valid(port);
    const member = await rename('ajar: bool', 'open');
    assert.match(member, /seen = door\.open;/u);
    assert.match(member, /\{ e: Fast; open: Fast; \}/u);
    await valid(member);
    const event = await rename('e(n: int); }', 'ev');
    assert.match(event, /\{ ev: Fast; ajar: Fast; \}/u);
    await valid(event);
});

test('WP6-M05 the formatter prints member-policy bodies one member per line and initial values, idempotently', async () => {
    const source = 'package Test { import Swaml::Qos; port def P { provides attribute a: int=3; provides event e(); } qos def Q: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 1; overflow = Overflow.dropOldest; requestTimeout = 1s; } component def S { port o: P; operation t() { send o.a(1); publish o.e(); } schedule { on every 1ms t(); } } component def R { reversed port p: P; attribute k: int = 0; operation handle() { k = p.a; } schedule { on receive p.e() handle(); } } component Demo { component s: S; component r: R; connect link: Q (s.o, r.p) { e: Q; a: Q; } } }';
    const { doc } = await parse(source);
    const formatted = formatDocument(doc);
    assert.ok(formatted.includes('    provides attribute a: int = 3;\n'));
    assert.ok(formatted.includes('    connect link: Q (s.o, r.p) {\n      e: Q;\n      a: Q;\n    }\n'), formatted);
    const again = await parseHelper<Model>(createSwamlServices(EmptyFileSystem).Swaml)(formatted);
    assert.equal(formatDocument(again), formatted);
});

test('WP6-M02 WP6-M03 the KerML inventory maps MemberPolicy as a reference and PortMember with its initial value', () => {
    const mapping = JSON.parse(readFileSync(new URL('spec/kerml-mapping.json', root), 'utf8')).mapping as { source: string; kind: string; semantic: string }[];
    assert.equal(mapping.find(m => m.source === 'MemberPolicy')?.kind, 'reference');
    assert.match(mapping.find(m => m.source === 'PortMember')!.semantic, /default value \(WP6-S02\)/);
});

test('WP6 examples: door status sampling and body CAN member policies pass their cases, deterministically', async () => {
    const cases: Record<string, string[]> = {
        'examples/48-door-status-sampling.swaml': ['DoorStatus::Initial values before the first delivery', 'DoorStatus::Latest value at each frame', 'DoorStatus::Live read after a wait'],
        'examples/49-body-can-member-policies.swaml': ['BodyCan::Crash frames queue, status frames keep the newest', 'BodyCan::One policy for both members loses crash frames'],
    };
    for (const [file, names] of Object.entries(cases)) {
        const { model } = await valid(readFileSync(new URL(file, root), 'utf8'));
        for (const name of names) {
            const first = runCase([model], name, { untilNs: 10000000000 }), second = runCase([model], name, { untilNs: 10000000000 });
            assert.equal(first.result, 'pass', `${name}: ${first.message ?? ''}`);
            assert.deepEqual(first.run?.trace, second.run?.trace);
        }
    }
    // A 2.2 source runs with no sample observation and no member-policy lookup difference.
    const plain = await run(policies('', 'connect (s.out, r.p);'), 5000000);
    assert.equal(kinds(plain.trace as Observation[], 'sample').length, 0);
    assert.ok(simulate);
});
