import nodeTest from 'node:test';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
import assert from 'node:assert/strict';
import { AstUtils, GrammarAST } from 'langium';
import { invalid, parse, valid } from './helpers.js';
import { CONTEXTUAL_KEYWORDS, RESERVED_WORDS, formatName, formatPath, formatQualifiedName, nameProblem, parseNameInput, parsePathInput } from '../../src/language/names.js';
import { SwamlGrammar } from '../../src/language/generated/grammar.js';
import { projectModel } from '../../src/language/projection.js';
import { selectView } from '../../src/language/presentation.js';
import * as a from '../../src/language/generated/ast.js';
const routed = (cases: string) => `package Test {
  import Swaml::Views;
  port def P { provides event ping(); }
  component def Sender { port p: P; operation emit() { publish p.ping(); } schedule { on start emit(); } }
  component def Receiver { reversed port p: P; operation take() { } schedule { on receive p.ping() take(); } }
  component def Idle { }
  requirement R { }
  component Demo { component sender: Sender; component receiver: Receiver; component other: Idle; connect (sender.p, receiver.p); ${cases} }
  component Elsewhere { component other: Idle; }
}`;
const boundary = (cases: string, extra = '') => `package Test {
  import Swaml::Views;
  requirement R { }
  port def Panel { provides event card(); requires event cash(); }
  port def Bank { requires operation authorize() returns bool; }
  component def Customer {
    port panel: Panel;
    operation insert() { publish panel.card(); }
    operation take() { }
    schedule { on start insert(); on receive panel.cash() take(); }
  }
  component def Issuer {
    reversed port link: Bank;
    operation authorize() returns bool { return true; }
    schedule { on call link.authorize() authorize(); }
  }
  component def Atm {
    reversed port panel: Panel;
    port bank: Bank;
    operation serve() { var approved: bool = bank.authorize(); if (approved) { publish panel.cash(); } }
    schedule { on receive panel.card() serve(); }
    ${cases}
  }
  component Branch { component customer: Customer; component atm: Atm; component issuer: Issuer; connect (customer.panel, atm.panel); connect (atm.bank, issuer.link); }
  ${extra}
}`;
async function rename(text: string, needle: string, newName: string) {
    const r = await valid(text), offset = text.indexOf(needle);
    assert.ok(offset >= 0);
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
test('reserved and contextual words match the grammar', () => {
    const keywords = new Set(AstUtils.streamAllContents(SwamlGrammar()).filter(GrammarAST.isKeyword).map(k => k.value).filter(k => /^[A-Za-z]\w*$/.test(k)));
    const nameRule = SwamlGrammar().rules.find(r => r.name === 'Name')!;
    const contextual = new Set(AstUtils.streamAllContents(nameRule).filter(GrammarAST.isKeyword).map(k => k.value));
    assert.deepEqual([...contextual].sort(), [...CONTEXTUAL_KEYWORDS].sort());
    assert.deepEqual([...RESERVED_WORDS].sort(), [...keywords].filter(k => !contextual.has(k)).sort());
});
test('name spelling quotes only when needed and round-trips', () => {
    assert.equal(formatName('Pump'), 'Pump');
    assert.equal(formatName('Withdraw cash'), "'Withdraw cash'");
    assert.equal(formatName('state'), "'state'");
    assert.equal(formatName('name'), 'name');
    assert.equal(formatName("it's"), "'it\\'s'");
    assert.equal(formatQualifiedName('Cash Machine::Teller'), "'Cash Machine'::Teller");
    assert.equal(formatPath('Shop::Order Service.link[2].ready'), "Shop::'Order Service'.link[2].ready");
    assert.equal(formatPath('Shop::Demo.port'), "Shop::Demo.'port'");
    assert.equal(parseNameInput("  'Withdraw cash' "), 'Withdraw cash');
    assert.equal(parseNameInput('Withdraw cash'), 'Withdraw cash');
    assert.equal(parsePathInput("Shop :: 'Order Service' . port[ 2 ].ready"), 'Shop::Order Service.port[2].ready');
    assert.equal(formatPath(parsePathInput("'Cash Machine'::Branch.'state'")), "'Cash Machine'::Branch.'state'");
    assert.equal(formatPath(parsePathInput('Cash Machine::Branch.atm')), "'Cash Machine'::Branch.atm");
    for (const bad of ['', ' padded', 'two  spaces', 'a.b', 'a::b', 'x[1]', 'tab\there'])
        assert.ok(nameProblem(bad), bad);
    assert.equal(nameProblem('Bestellübersicht'), undefined);
});
test('quoted names declare, reference and qualify elements', async () => {
    const r = await valid(`package 'Cash Machine' {
  datatype Customer { name: string; kind: string; path: string; }
  component def 'ATM Controller' { attribute 'state': int = 0; operation 'reset all'() { 'state' = 0; } schedule { on start 'reset all'(); } }
  component Branch { component atm: 'ATM Controller'; component 'Bestellübersicht': 'ATM Controller'; }
}
package Other { import 'Cash Machine'; component Copy: 'Cash Machine'::'ATM Controller'; }`);
    const def = r.model.packages[0].elements.find(a.isComponentDef)!;
    assert.equal(r.model.packages[0].name, 'Cash Machine');
    assert.equal(def.name, 'ATM Controller');
    assert.equal((r.model.packages[1].elements[0] as a.ComponentUsage).definition?.ref, def);
});
test('quoted names cannot hide path separators or untidy spaces', async () => {
    for (const name of ["'a.b'", "'a:b'", "'x[1]'", "' padded'", "'two  spaces'", "''"])
        await invalid(`package Test { component def ${name} { } }`, 'SW2001');
});
test('parser messages explain spaces, double quotes, reserved words and doc placement', async () => {
    const message = async (source: string) => (await parse(source)).errors.map(e => e.message).join('\n');
    assert.match(await message('package Test { component def Order Service { } }'), /must be quoted, for example 'Order Service'/);
    assert.match(await message('package Test { component def "Order Service" { } }'), /Names use single quotes, for example 'Order Service'/);
    assert.match(await message('package Test { datatype R { state: int; } }'), /'state' is a reserved word/);
    assert.match(await message('package Test { component def A { } /** Doc. */ component def C { } }'), /documentation comment belongs first inside the braces/);
    const unicode = await message('package Test { component def Bestellübersicht { } }');
    assert.match(unicode, /quoted name, for example 'Bestellübersicht'/);
    assert.doesNotMatch(unicode, /Bestell bersicht/);
});
test('rename writes quoted names wherever the name is spelled', async () => {
    const source = routed("use case Start { actor caller: Sender; publish first from sender.p.ping to receiver.p.ping; }").replace('component Elsewhere', 'view v: General { include Demo recursive where path == "Test::Demo.receiver"; }\n  component Elsewhere');
    const next = await rename(source, 'receiver: Receiver', 'Cash desk');
    assert.match(next, /component 'Cash desk': Receiver/);
    assert.match(next, /connect \(sender\.p, 'Cash desk'\.p\)/);
    assert.match(next, /to 'Cash desk'\.p\.ping/);
    assert.match(next, /path == "Test::Demo\.Cash desk"/);
    const back = await rename(next, "'Cash desk': Receiver", 'receiver');
    assert.equal(back, source);
    assert.match(await rename(source, 'Receiver {', 'operation'), /component receiver: 'operation';/);
});
test('use case and verification case keywords; the 2.0 forms are gone', async () => {
    const r = await valid(routed('use case Start { } verification case Check { }'));
    const demo = r.model.packages[0].elements.find((e): e is a.ComponentUsage => a.isComponentUsage(e) && e.name === 'Demo')!;
    assert.deepEqual(demo.members.filter(a.isScenario).map(s => s.kind), ['useCase', 'verificationCase']);
    for (const old of ['useCase Old { }', 'verificationCase Older { }', 'use case Rooted of Demo { }'])
        assert.ok((await parse(routed(old))).errors.length, old);
    await valid('package Test { component Demo { attribute use: int = 0; attribute case: int = 1; attribute subject: int = 2; attribute actor: int = 3; attribute extend: int = 4; attribute verification: int = 5; attribute useCase: int = 6; } }');
});
test('the owner is the subject; actors are typed roles; relations stay within one subject', async () => {
    const r = await valid(boundary(`use case 'Withdraw cash' { actor customer: Customer; include Log; publish 'insert card' from customer.panel.card to panel.card; publish dispense from panel.cash to customer.panel.cash after 'insert card'; }
    use case Log { actor customer: Customer; }
    use case Retry { extend 'Withdraw cash'; }`));
    const edges = projectModel([r.model]).edges.filter(e => ['subject', 'actor', 'include', 'extend'].includes(e.kind) && e.source.startsWith('Test::Atm.')).map(e => `${e.kind} ${e.source} ${e.target}`);
    assert.deepEqual(edges, ['subject Test::Atm.Withdraw cash Test::Atm', 'actor Test::Atm.Withdraw cash Test::Atm.Withdraw cash.customer', 'include Test::Atm.Withdraw cash Test::Atm.Log', 'subject Test::Atm.Log Test::Atm', 'actor Test::Atm.Log Test::Atm.Log.customer', 'subject Test::Atm.Retry Test::Atm', 'extend Test::Atm.Retry Test::Atm.Withdraw cash']);
    const projection = projectModel([r.model]), actor = projection.nodes.find(n => n.id === 'Test::Atm.Withdraw cash.customer')!;
    assert.deepEqual([actor.kind, actor.definition], ['actor', 'Test::Customer']);
    // Each occurrence of the subject carries the case and relates it within that occurrence.
    assert.ok(projection.edges.some(e => e.kind === 'subject' && e.source === 'Test::Branch.atm.Withdraw cash' && e.target === 'Test::Branch.atm'));
    assert.ok(projection.edges.some(e => e.kind === 'include' && e.source === 'Test::Branch.atm.Withdraw cash' && e.target === 'Test::Branch.atm.Log'));
    const view = await valid(boundary("use case 'Withdraw cash' { }", "view v: Case { include Atm.'Withdraw cash'; } view w: Sequence of Atm; view x: Case of Branch.atm;"));
    assert.equal(selectView(view.model.packages[0].elements.find(a.isView)!, [view.model])[0].name, 'Withdraw cash');
});
test('renaming an actor or a subject port updates the step ends', async () => {
    const source = boundary("use case Serve { actor customer: Customer; publish 'insert card' from customer.panel.card to panel.card; }");
    const actor = await rename(source, 'customer: Customer; publish', 'Card holder');
    assert.match(actor, /actor 'Card holder': Customer;/);
    assert.match(actor, /from 'Card holder'\.panel\.card to panel\.card;/);
    assert.match(actor, /component customer: Customer;/);
    const port = await rename(source, 'panel: Panel;\n    port bank', 'front');
    assert.match(port, /from customer\.panel\.card to front\.card;/);
});
test('a package use case has no subject and states intent only', async () => {
    const r = await valid(`package Test { component def Customer { } requirement R { } use case Draft { /** The subject is decided later. */ actor customer: Customer; include Plan; } use case Plan { } verification case Check { verify R; } }`);
    assert.deepEqual(r.model.packages[0].elements.filter(a.isScenario).map(s => s.name), ['Draft', 'Plan', 'Check']);
    assert.deepEqual(projectModel([r.model]).edges.filter(e => ['subject', 'include'].includes(e.kind)).map(e => `${e.kind} ${e.source} ${e.target}`), ['include Test::Draft Test::Plan']);
    await invalid(`package Test { component def Customer { port p: P; } port def P { provides event ping(); } use case Draft { actor customer: Customer; publish x from customer.p.ping to customer.p.ping; } }`, 'SW2010');
});
test('cases of a definition apply to each occurrence and to specializations', async () => {
    const r = await valid(boundary("use case Serve { actor customer: Customer; publish 'insert card' from customer.panel.card to panel.card; }", 'component def Kiosk specializes Atm { use case Help { include Serve; } }'));
    const ids = projectModel([r.model]).nodes.filter(n => n.kind === 'useCase').map(n => n.id);
    for (const id of ['Test::Atm.Serve', 'Test::Kiosk.Help', 'Test::Kiosk.Serve', 'Test::Branch.atm.Serve'])
        assert.ok(ids.includes(id), id);
});
test('owned satisfy claims its component; a package satisfy names its source', async () => {
    await valid('package Test { requirement R { } component def Pump { satisfy R; } component Demo { component pump: Pump; } satisfy R of Demo.pump; }');
    await invalid('package Test { requirement R { } component def Pump { satisfy R of pump; } }', 'SW2010');
    await invalid('package Test { requirement R { } component def Pump { satisfy R; satisfy R; } }', 'SW2010');
    await invalid('package Test { requirement R { } component def Pump { } satisfy R; }', 'SW2010');
});
for (const [name, cases] of [
    ['actor named like a subject member', 'use case A { actor sender: Sender; }'],
    ['unknown endpoint', 'use case A { publish first from missing.p.ping to receiver.p.ping; }'],
    ['internal step without a route', 'use case A { publish first from sender.p.ping to other.p.ping; }'],
    ['verification case include', 'verification case A { include B; } use case B { }'],
    ['include of a verification case', 'use case A { include B; } verification case B { }'],
    ['self include', 'use case A { include A; }'],
    ['include cycle', 'use case A { include B; } use case B { extend A; }'],
    ['duplicate include', 'use case A { include B; include B; } use case B { }'],
    ['verify in use case', 'use case A { verify R; }'],
] as const)
    test(`rejects ${name}`, () => invalid(routed(cases), 'SW2010'));
test('rejects duplicate actors and actors typed by a usage', async () => {
    await invalid(routed('use case A { actor caller: Sender; actor caller: Sender; }'), 'SW2001');
    await invalid(routed('use case A { actor caller: Demo; }'), 'SW2001');
});
for (const [name, cases] of [
    ['actors talking to each other', 'use case A { actor one: Customer; actor two: Customer; publish x from one.panel.card to two.panel.card; }'],
    ['actor reaching a part inside the subject', 'use case A { actor customer: Customer; publish x from customer.panel.card to inner.panel.card; }'],
    ['via on a boundary exchange', 'use case A { actor customer: Customer; publish x from customer.panel.card to panel.card via wire; }'],
    ['incompatible actor port', 'use case A { actor teller: Teller; request x from bank.authorize to teller.link.authorize; }'],
    ['wrong direction across the boundary', 'use case A { actor customer: Customer; publish x from panel.card to customer.panel.card; }'],
    ['include across subjects', 'use case A { include Plan; }'],
] as const)
    test(`rejects ${name}`, () => invalid(boundary(cases, 'component def Inner { reversed port panel: Panel; } component def Teller { port link: Bank; } use case Plan { }').replace('port bank: Bank;', 'port bank: Bank;\n    component inner: Inner;'), 'SW2010'));
test('inherited provenance findings are reported once', async () => {
    const r = await parse('package Test { port def P { provides event ping(); } component def A { port p: P; } component Demo { component a: A; component b: A; } }');
    const messages = r.errors.filter(e => e.code === 'SW2005').map(e => e.message);
    assert.deepEqual(messages, [...new Set(messages)]);
    assert.ok(messages.length > 0);
});
