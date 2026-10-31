import nodeTest from 'node:test';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
import assert from 'node:assert/strict';
import { invalid, parse, valid, workspace } from './helpers.js';
import { projectModel } from '../../src/language/projection.js';
import { interfaceOnly } from '../../src/language/semantic.js';
import * as a from '../../src/language/generated/ast.js';
/** A package context: definitions, top-level occurrences, package connections and links. */
const bank = (members = '', extra = '') => `package Banking {
  import Swaml::Views;
  port def Panel { provides event cashRequested(amount: uint); requires event cashOut(paid: uint); }
  port def BankLink { requires operation authorize(amount: uint) returns bool; }
  requirement 'Cash limit' { /** Withdrawals above the limit are refused. */ }
  requirement Audit { }
  component def Customer { port panel: Panel; }
  component def ATM {
    reversed port panel: Panel;
    port link: BankLink;
    component dispenser: Dispenser;
    operation serve(amount: uint) { var ok: bool = link.authorize(amount); if (ok) { publish panel.cashOut(amount); } }
    schedule { on receive panel.cashRequested(amount) serve(amount); }
  }
  component def Dispenser { }
  component def BankHost {
    reversed port link: BankLink;
    operation authorize(amount: uint) returns bool { return amount <= 500; }
    schedule { on call link.authorize(amount) authorize(amount); }
  }
  component atm: ATM;
  component customer: Customer;
  component bank: BankHost;
  ${members}
}
${extra}`;
const wired = (links = '', extra = '') => bank(`connect (customer.panel, atm.panel);
  connect (atm.link, bank.link);
  ${links}`, extra);
async function rename(text: string, needle: string, newName: string) {
    const r = await valid(text), offset = text.indexOf(needle);
    assert.ok(offset >= 0, needle);
    const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(offset), newName });
    assert.ok(edit, 'rename should produce a validated edit');
    let next = text;
    for (const change of edit.documentChanges ?? [])
        if ('textDocument' in change)
            for (const e of [...change.edits].sort((x, y) => r.doc.textDocument.offsetAt(y.range.start) - r.doc.textDocument.offsetAt(x.range.start)))
                if ('newText' in e)
                    next = next.slice(0, r.doc.textDocument.offsetAt(e.range.start)) + e.newText + next.slice(r.doc.textDocument.offsetAt(e.range.end));
    await valid(next);
    return next;
}
const messages = async (source: string, code: string) => (await parse(source)).errors.filter(e => e.code === code).map(e => String(e.message));

// Package context and closure.
test('package connections join top-level occurrences and close their ports', async () => {
    const r = await valid(wired());
    const edges = projectModel([r.model]).edges.filter(e => e.kind === 'connection').map(e => `${e.source} ${e.target}`);
    assert.deepEqual(edges, ['Banking::customer.panel Banking::atm.panel', 'Banking::atm.link Banking::bank.link']);
});
test('named and policy-bearing package connections', () => valid(bank(`connect front: Swaml::Qos::Default (customer.panel, atm.panel);
  connect back (atm.link, bank.link);`)));
test('closure is per package: an unconnected top-level port is reported with its package', async () => {
    const found = await messages(bank('connect (customer.panel, atm.panel);'), 'SW2004');
    assert.ok(found.includes('Unconnected required port atm.link in package Banking.'), JSON.stringify(found));
    assert.ok(found.includes('Unconnected required port bank.link in package Banking.'), JSON.stringify(found));
});
test('an optional top-level port may stay open', () => valid(`package Test { port def P { provides event ping(); } component def A { optional port p: P; operation emit() { publish p.ping(); } schedule { on start emit(); } } component a: A; }`));
test('a required top-level port with a requires operation needs exactly one peer', async () => {
    const found = await messages(bank(`component bank2: BankHost; connect (customer.panel, atm.panel); connect (atm.link, bank.link); connect (atm.link, bank2.link);`), 'SW2004');
    assert.ok(found.includes('Port atm.link requires exactly one peer after forwarding.'), JSON.stringify(found));
});
test('a package connection reaches a part through boundary forwarding', () => valid(`package Test {
  port def P { provides event ping(); }
  component def Source { port p: P; operation emit() { publish p.ping(); } schedule { on start emit(); } }
  component def Sink { reversed port p: P; operation take() { } schedule { on receive p.ping() take(); } }
  component def Shell { reversed port p: P; component inner: Sink; connect (p, inner.p); }
  component source: Source;
  component shell: Shell;
  connect (source.p, shell.p);
}`));
test('duplicate connections after forwarding resolution are rejected across the package', async () => {
    const found = await messages(`package Test {
  port def P { provides event ping(); }
  component def Source { port p: P; operation emit() { publish p.ping(); } schedule { on start emit(); } }
  component def Sink { reversed port p: P; operation take() { } schedule { on receive p.ping() take(); } }
  component source: Source;
  component sink: Sink;
  connect (source.p, sink.p);
  connect (sink.p, source.p);
}`, 'SW2004');
    assert.ok(found.includes('Duplicate or self connector.'), JSON.stringify(found));
});
for (const [name, link, message] of [
    ['a nested endpoint', 'connect (customer.panel, atm.dispenser.panel);', /must name a port of a top-level component occurrence of package Banking/],
    ['an unknown port', 'connect (customer.panel, atm.missing);', /must name a port of a top-level component occurrence/],
    ['a definition endpoint', 'connect (customer.panel, ATM.panel);', /must name a port of a top-level component occurrence/],
    ['a self connection', 'connect (customer.panel, customer.panel);', /Duplicate or self connector/],
    ['incompatible ports', 'connect (customer.panel, bank.link);', /^Connection: /],
] as const)
    test(`rejects a package connection with ${name}`, async () => assert.ok((await messages(bank(link), 'SW2004')).some(m => message.test(m))));
test('occurrences cannot be connected across packages', async () => {
    const r = await workspace([bank(), `package Other { import Banking; component other: Customer; connect (other.panel, atm.panel); }`]);
    const found = r.docs[1].diagnostics?.filter(d => d.code === 'SW2004').map(d => String(d.message)) ?? [];
    assert.ok(found.some(m => /Occurrences cannot be connected across packages: atm is not declared in package Other/.test(m)), JSON.stringify(found));
});
test('closure inside a component is unchanged', () => invalid(`package Test { port def P { provides event ping(); } component def A { port p: P; operation emit() { publish p.ping(); } } component def B { reversed port p: P; operation take() { } schedule { on receive p.ping() take(); } } component Demo { component a: A; component b: B; } }`, 'SW2004'));
test('a package connection with at least once delivery needs idempotent provided operations', async () => {
    const policy = 'qos def Retry: Swaml::Qos::Default { delivery = Swaml::Qos::Delivery.atLeastOnce; ordering = Swaml::Qos::Ordering.fifo; capacity = 4; overflow = Swaml::Qos::Overflow.reject; requestTimeout = 1s; }';
    assert.ok((await messages(bank(`${policy} connect (customer.panel, atm.panel); connect: Retry (atm.link, bank.link);`), 'SW2013')).some(m => m.includes('idempotent')));
});
test('package connection names share the package namespace and cannot redefine', async () => {
    await invalid(bank('connect atm (customer.panel, atm.panel); connect (atm.link, bank.link);'), 'SW2001');
    await invalid(bank('redefines connect (customer.panel, atm.panel); connect (atm.link, bank.link);'), 'SW2003');
});

// Interface-only components.
test('an interface-only component needs no implementation', async () => {
    const r = await valid(wired());
    const customer = r.model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'Customer')!;
    assert.equal(interfaceOnly(customer), true);
    assert.equal(interfaceOnly(r.model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'ATM')!), false);
    assert.equal(interfaceOnly(r.model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'Dispenser')!), false, 'no ports');
});
test('interface-only covers specializations and bodied usages', async () => {
    await valid(`package Test { port def P { provides event ping(); requires attribute level: int; } component def Stub { port p: P; } component def Probe specializes Stub { optional port q: P; } component probe: Probe; component other { reversed port p: P; } connect (probe.p, other.p); }`);
});
test('a component with behavior still needs emission and input owners', async () => {
    const found = await messages(`package Test { port def P { provides event ping(); requires event pong(); } component def A { port p: P; operation idle() { } } component a: A; component b { reversed port p: P; } connect (a.p, b.p); }`, 'SW2005');
    assert.deepEqual(found.sort(), ['p.ping needs an emitting operation.', 'p.pong needs exactly one input owner.']);
});
test('a part or schedule makes a component implemented', async () => {
    await invalid(`package Test { port def P { provides event ping(); } component def Empty { } component def A { port p: P; component part: Empty; } component a: A; component b { reversed port p: P; } connect (a.p, b.p); }`, 'SW2005');
});

// Use cases and tests.
test('use cases and tests are package members with an optional subject', async () => {
    const r = await valid(wired(`use case Withdraw of atm { /** A customer withdraws cash within the limit. */ }
  use case 'Open a branch' { }
  test 'Fee rounding' of atm { }
  test Draft { /** Intent only. */ }`));
    const cases = r.model.packages[0].elements.filter(a.isScenario);
    assert.deepEqual(cases.map(c => [c.kind, c.name, c.subject?.ref?.name]), [['useCase', 'Withdraw', 'atm'], ['useCase', 'Open a branch', undefined], ['test', 'Fee rounding', 'atm'], ['test', 'Draft', undefined]]);
    const projection = projectModel([r.model]);
    assert.deepEqual(projection.nodes.filter(n => ['useCase', 'test'].includes(n.kind)).map(n => `${n.kind} ${n.id}`), ['useCase Banking::Withdraw', 'useCase Banking::Open a branch', 'test Banking::Fee rounding', 'test Banking::Draft']);
    assert.deepEqual(projection.edges.filter(e => e.kind === 'subject').map(e => `${e.source} ${e.target}`), ['Banking::Withdraw Banking::atm', 'Banking::Fee rounding Banking::atm']);
    assert.equal(projection.nodes.find(n => n.id === 'Banking::Withdraw')!.doc, 'A customer withdraws cash within the limit.');
});
test('the subject is a top-level occurrence of the same package', async () => {
    const r = await workspace([wired(), `package AtmTests { import Banking; use case Remote of atm { } }`]);
    const found = r.docs[1].diagnostics?.filter(d => d.severity === 1).map(d => `${d.code} ${String(d.message)}`) ?? [];
    assert.ok(found.some(m => m.startsWith('SW2010 The subject of Remote must be a top-level component occurrence of package AtmTests')), JSON.stringify(found));
    await invalid(wired('use case Bad of ATM { }'));
    await invalid(wired('use case Nested of atm.dispenser { }'));
    await invalid(wired('use case Missing of nobody { }'));
});
test('a local occurrence shadows an imported one of the same name', async () => {
    const r = await workspace([wired(), `package AtmTests { import Banking; component atm: ATM; component customer: Customer; component bank: BankHost; connect (customer.panel, atm.panel); connect (atm.link, bank.link); test Local of atm { } associate customer to Local; }`]);
    assert.deepEqual(r.docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []);
});
test('case names share the package namespace', () => invalid(wired('use case atm { } '), 'SW2001'));

// Package links.
test('associate, satisfy and verify are package links', async () => {
    const r = await valid(wired(`use case Withdraw of atm { }
  test 'Bank refusal' of atm { }
  test 'Fee rounding' of atm { }
  associate customer to Withdraw;
  associate bank to 'Bank refusal';
  associate customer to 'Bank refusal';
  satisfy 'Cash limit' by atm;
  satisfy 'Cash limit' by ATM;
  satisfy Audit by atm.dispenser;
  satisfy Audit by BankHost;
  verify 'Cash limit' by 'Bank refusal';
  verify 'Cash limit' by 'Fee rounding';
  verify Audit by 'Bank refusal';`));
    const edges = projectModel([r.model]).edges.filter(e => ['associate', 'satisfy', 'verify'].includes(e.kind)).map(e => `${e.kind} ${e.source} ${e.target}`);
    assert.deepEqual(edges, [
        'associate Banking::customer Banking::Withdraw', 'associate Banking::bank Banking::Bank refusal', 'associate Banking::customer Banking::Bank refusal',
        'satisfy Banking::atm Banking::Cash limit', 'satisfy Banking::ATM Banking::Cash limit', 'satisfy Banking::atm.dispenser Banking::Audit', 'satisfy Banking::BankHost Banking::Audit',
        'verify Banking::Bank refusal Banking::Cash limit', 'verify Banking::Fee rounding Banking::Cash limit', 'verify Banking::Bank refusal Banking::Audit']);
});
test('satisfy accepts indexed parts within their multiplicity', async () => {
    await valid(`package Test { requirement R { } component def Cell { } component def Grid { component cells: Cell[2]; } component grid: Grid; satisfy R by grid.cells[1]; satisfy R by Grid.cells; }`);
    await invalid(`package Test { requirement R { } component def Cell { } component def Grid { component cells: Cell[2]; } component grid: Grid; satisfy R by grid.cells[2]; }`, 'SW2010');
});
test('requirements may be imported into the package that declares the design', async () => {
    const r = await workspace([`package Reqs { requirement Shared { } }`, `package Impl { import Reqs; component def Pump { } component pump: Pump; test Check of pump { } satisfy Shared by pump; satisfy Reqs::Shared by Pump; verify Shared by Check; }`]);
    assert.deepEqual(r.docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []);
});
for (const [name, links, message] of [
    ['associating the subject', 'use case Withdraw of atm { } associate atm to Withdraw;', 'atm is the subject of Withdraw; associate names another participant.'],
    ['a duplicate association', 'use case Withdraw of atm { } associate customer to Withdraw; associate customer to Withdraw;', 'Duplicate associate customer to Withdraw.'],
    ['an unknown satisfy design', "satisfy 'Cash limit' by atm.missing;", "satisfy by names a component definition or component occurrence path of package Banking; atm.missing is not one."],
    ['a satisfy of a port', "satisfy 'Cash limit' by atm.panel;", "satisfy by names a component definition or component occurrence path of package Banking; atm.panel is not one."],
    ['a duplicate satisfy', "satisfy 'Cash limit' by atm; satisfy 'Cash limit' by atm;", "Duplicate satisfy Cash limit by atm."],
    ['verify by a use case', "use case Withdraw of atm { } verify 'Cash limit' by Withdraw;", 'verify names a test; Withdraw is a use case.'],
    ['a duplicate verify', "test T { } verify 'Cash limit' by T; verify 'Cash limit' by T;", 'Duplicate verify Cash limit by T.'],
] as const)
    test(`rejects ${name}`, async () => { const found = await messages(wired(links), 'SW2010'); assert.ok(found.includes(message), JSON.stringify(found)); });
test('link diagnostics carry the range of the offending reference', async () => {
    const source = wired("use case Withdraw of atm { } verify 'Cash limit' by Withdraw;"), r = await parse(source);
    const d = r.errors.find(e => e.message === 'verify names a test; Withdraw is a use case.')!;
    assert.equal(r.doc.textDocument.offsetAt(d.range.start), source.lastIndexOf('Withdraw'));
});
test('links name elements of their own package', async () => {
    const r = await workspace([wired('use case Withdraw of atm { } test Probe of atm { }'), `package Other { import Banking; component def Local { } component local: Local; associate customer to Withdraw; associate local to Withdraw; satisfy 'Cash limit' by atm; satisfy 'Cash limit' by ATM; verify 'Cash limit' by Probe; }`]);
    const found = r.docs[1].diagnostics?.filter(d => d.code === 'SW2010').map(d => String(d.message)) ?? [];
    for (const expected of ['associate names a top-level component occurrence of package Other; customer is declared elsewhere.', 'associate names a use case or test of package Other; Withdraw is declared elsewhere.', 'satisfy names a component declared in package Other; write this claim in the package that declares atm.', 'satisfy names a component declared in package Other; write this claim in the package that declares ATM.', 'verify names a test of package Other; Probe is declared elsewhere.'])
        assert.ok(found.includes(expected), expected + ' in ' + JSON.stringify(found));
});

// Removed forms are ordinary errors.
for (const [name, source] of [
    ['a case inside a component', 'package Test { component Demo { use case A { } } }'],
    ['a test inside a component', 'package Test { component def C { test A { } } }'],
    ['the verification case keyword', 'package Test { verification case A { } }'],
    ['useCase', 'package Test { useCase A { } }'],
    ['actor roles', 'package Test { component def C { } use case A { actor c: C; } }'],
    ['include between cases', 'package Test { use case A { include B; } use case B { } }'],
    ['extend between cases', 'package Test { use case A { extend B; } use case B { } }'],
    ['verify inside a case', 'package Test { requirement R { } test A { verify R; } }'],
    ['declarative steps', 'package Test { use case A { publish x from a.p.e to b.p.e via w after y; } }'],
    ['request and reply steps', 'package Test { test A { request r from a.p.op to b.p.op; reply q from b.p.op to a.p.op after r; } }'],
    ['a satisfy without by', 'package Test { requirement R { } component def C { } satisfy R; }'],
    ['satisfy of a path', 'package Test { requirement R { } component def C { } component c: C; satisfy R of c; }'],
    ['satisfy inside a component', 'package Test { requirement R { } component def C { satisfy R; } }'],
    ['a verify without by', 'package Test { requirement R { } verify R; }'],
    ['a qualified subject', 'package Test { component def C { } component c: C; use case A of Test::c { } }'],
    ['statements in a case body before executable cases', 'package Test { component def C { } component c: C; test A of c { assert true; } }'],
] as const)
    test(`rejects removed or unsupported form: ${name}`, async () => assert.ok((await parse(source)).errors.some(e => e.code === 'SW2000'), source));
for (const partial of ['package P { connect (a.p, ', 'package P { associate x to', 'package P { satisfy R by ;', 'package P { verify R by', 'package P { use case X of { } }', 'package P { test { } }', 'package P { test X of y { /** doc */'])
    test(`malformed recovery ${partial}`, async () => { const r = await parse(partial); assert.ok(r.errors.length); assert.ok(!r.errors.some(x => /exception/i.test(String(x.message)))); });

// Names and keywords.
test('new soft keywords and duration units remain usable as names', async () => {
    await valid(`package Test { component Demo { attribute test: int = 0; attribute associate: int = 1; attribute by: int = 2; attribute ns: int = 3; attribute us: int = 4; attribute ms: int = 5; attribute s: int = 6; operation run() { wait 5 s; wait 1 ms; var total: int = test + associate + by + ns + us + ms + s; s = total; } schedule { on every 10 ms run(); } } }`);
    await valid(`package test { component def by { } component associate: by; use case s of associate { } test ms { } associate associate to ms; }`);
});
test('words of removed productions are no longer keywords', () => valid(`package Test { component Demo { attribute from: int = 0; attribute request: int = 1; attribute reply: int = 2; attribute via: int = 3; attribute actor: int = 4; attribute extend: int = 5; attribute verification: int = 6; } }`));
test('durations in policies and timeouts still parse beside names', () => valid(`package Test {
  import Swaml::Qos;
  qos def Fast: Default { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.reject; requestTimeout = 5 ms; }
  port def P { provides event ping(); }
  component def Sink { reversed port p: P; attribute s: int = 0; operation take() { on receive p.ping() { s = 1; } or after 2 s { s = 2; } } schedule { on start take(); } }
  component def Source { port p: P; operation emit() { publish p.ping(); } schedule { on every 1 s emit() deadline 10 ms; } }
  component sink: Sink;
  component source: Source;
  connect: Fast (source.p, sink.p);
}`));

// Views.
test('Case views select packages and cases; Sequence views select cases', async () => {
    await valid(wired('use case Withdraw of atm { } view overview: Case of Banking; view flow: Sequence of Withdraw; view whole: Sequence of Banking;'));
});

// Authoring.
test('renaming a top-level occurrence updates connections, cases and links', async () => {
    const source = wired(`use case Withdraw of atm { } associate customer to Withdraw; satisfy 'Cash limit' by atm.dispenser;`);
    const next = await rename(source, 'atm: ATM', 'Cash machine');
    assert.match(next, /connect \(customer\.panel, 'Cash machine'\.panel\);/);
    assert.match(next, /connect \('Cash machine'\.link, bank\.link\);/);
    assert.match(next, /use case Withdraw of 'Cash machine' \{ \}/);
    assert.match(next, /satisfy 'Cash limit' by 'Cash machine'\.dispenser;/);
    const customer = await rename(source, 'customer: Customer', 'client');
    assert.match(customer, /associate client to Withdraw;/);
    assert.match(customer, /connect \(client\.panel, atm\.panel\);/);
});
test('renaming a case or a port updates links and connection ends', async () => {
    const source = wired(`test Probe of atm { } verify 'Cash limit' by Probe; associate bank to Probe;`);
    const next = await rename(source, 'Probe of', 'Bank refusal');
    assert.match(next, /verify 'Cash limit' by 'Bank refusal';/);
    assert.match(next, /associate bank to 'Bank refusal';/);
    const port = await rename(source, 'link: BankLink;\n    component', 'uplink');
    assert.match(port, /connect \(atm\.uplink, bank\.link\);/);
});
test('go to definition from a package connection end and a link', async () => {
    const source = wired('test Probe of atm { } associate bank to Probe;'), r = await valid(source);
    const at = async (offset: number) => (await r.Swaml.lsp.DefinitionProvider!.getDefinition(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(offset) }))?.[0];
    const target = await at(source.indexOf('bank.link);'));
    assert.equal(r.doc.textDocument.offsetAt(target!.targetSelectionRange.start), source.indexOf('bank: BankHost'));
    const probe = await at(source.lastIndexOf('Probe'));
    assert.equal(r.doc.textDocument.offsetAt(probe!.targetSelectionRange.start), source.indexOf('Probe of'));
});
test('a cyclic top-level occurrence does not suspend closure for the others', async () => {
    const r = await parse(`package Test { port def P { provides event ping(); } component def Loop { component inner: Loop; } component def A { port p: P; operation emit() { publish p.ping(); } } component loop: Loop; component a: A; }`);
    const found = r.errors.map(e => `${e.code} ${String(e.message)}`);
    assert.ok(found.includes('SW2003 Component containment must be finite and acyclic.'), JSON.stringify(found));
    assert.ok(found.includes('SW2004 Unconnected required port a.p in package Test.'), JSON.stringify(found));
});
