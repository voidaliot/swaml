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
  component Demo { component sender: Sender; component receiver: Receiver; component other: Idle; connect (sender.p, receiver.p); }
  component Elsewhere { component other: Idle; }
  ${cases}
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
    const source = routed("use case Start of Demo { subject receiver; actor sender; publish first from sender.p.ping to receiver.p.ping; } view v: General { include Demo recursive where path == \"Test::Demo.receiver\"; }");
    const next = await rename(source, 'receiver: Receiver', 'Cash desk');
    assert.match(next, /component 'Cash desk': Receiver/);
    assert.match(next, /connect \(sender\.p, 'Cash desk'\.p\)/);
    assert.match(next, /subject 'Cash desk';/);
    assert.match(next, /to 'Cash desk'\.p\.ping/);
    assert.match(next, /path == "Test::Demo\.Cash desk"/);
    const back = await rename(next, "'Cash desk': Receiver", 'receiver');
    assert.equal(back, source);
    assert.match(await rename(source, 'Receiver {', 'operation'), /component receiver: 'operation';/);
});
test('use case and verification case keywords with deprecated 2.0 spellings', async () => {
    const r = await valid(routed('use case Start of Demo { } verification case Check of Demo { } useCase Old of Demo { } verificationCase Older of Demo { }'));
    const kinds = r.model.packages[0].elements.filter(a.isScenario).map(s => s.kind);
    assert.deepEqual(kinds, ['useCase', 'verificationCase', 'useCase', 'verificationCase']);
    assert.deepEqual(r.warnings.filter(w => w.code === 'SW2015').map(w => w.data?.suggestedEdits?.[0]?.newText), ['use case', 'verification case']);
    await valid('package Test { component Demo { attribute use: int = 0; attribute case: int = 1; attribute subject: int = 2; attribute actor: int = 3; attribute extend: int = 4; attribute verification: int = 5; } }');
});
test('subjects, actors and use case relations are validated and projected', async () => {
    const r = await valid(routed(`use case 'Send ping' of Demo { subject receiver; actor sender; include Log; publish first from sender.p.ping to receiver.p.ping; }
  use case Log of Demo { subject receiver; actor other; }
  use case Retry of Demo { subject receiver; actor sender; extend 'Send ping'; }`));
    const edges = projectModel([r.model]).edges.filter(e => ['subject', 'actor', 'include', 'extend'].includes(e.kind)).map(e => `${e.kind} ${e.source} ${e.target}`);
    assert.deepEqual(edges, ['subject Test::Send ping Test::Demo.receiver', 'actor Test::Send ping Test::Demo.sender', 'include Test::Send ping Test::Log', 'subject Test::Log Test::Demo.receiver', 'actor Test::Log Test::Demo.other', 'subject Test::Retry Test::Demo.receiver', 'actor Test::Retry Test::Demo.sender', 'extend Test::Retry Test::Send ping']);
    const view = await valid(routed("use case 'Send ping' of Demo { } view v: Case { include 'Send ping'; }"));
    assert.equal(selectView(view.model.packages[0].elements.find(a.isView)!, [view.model])[0].name, 'Send ping');
});
for (const [name, cases] of [
    ['actor without subject', 'use case A of Demo { actor sender; }'],
    ['unknown subject', 'use case A of Demo { subject missing; }'],
    ['actor inside subject', 'use case A of Demo { subject receiver; actor receiver; }'],
    ['duplicate actor', 'use case A of Demo { subject receiver; actor sender; actor sender; }'],
    ['step outside subject and actors', 'use case A of Demo { subject receiver; actor other; publish first from sender.p.ping to receiver.p.ping; }'],
    ['verification case include', 'verification case A of Demo { include B; } use case B of Demo { }'],
    ['include of a verification case', 'use case A of Demo { include B; } verification case B of Demo { }'],
    ['self include', 'use case A of Demo { include A; }'],
    ['include cycle', 'use case A of Demo { include B; } use case B of Demo { extend A; }'],
    ['include across roots', 'use case A of Demo { include B; } use case B of Elsewhere { }'],
    ['duplicate include', 'use case A of Demo { include B; include B; } use case B of Demo { }'],
    ['verify in use case', 'requirement R { } use case A of Demo { verify R; }'],
] as const)
    test(`rejects ${name}`, () => invalid(routed(cases), 'SW2010'));
test('inherited provenance findings are reported once', async () => {
    const r = await parse('package Test { port def P { provides event ping(); } component def A { port p: P; } component Demo { component a: A; component b: A; } }');
    const messages = r.errors.filter(e => e.code === 'SW2005').map(e => e.message);
    assert.deepEqual(messages, [...new Set(messages)]);
    assert.ok(messages.length > 0);
});
