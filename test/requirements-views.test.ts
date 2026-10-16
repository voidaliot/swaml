import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, documentationText, modelComments, selectView } from '../src/language/swaml-module.js';
import * as a from '../src/language/generated/ast.js';

async function parse(body: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<a.Model>(Swaml)(`package P { ${body} }`, { validation:true });
    assert.ok(!doc.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(doc.diagnostics));
    return doc;
}
const structure = `component def Worker { function run() { doc /* Perform work. */ } } component Demo { component first: Worker; component second: Worker; }`;
test('requirements have immutable typed attributes, formal raw text and explicit trace links', async () => {
    const doc = await parse(`requirement Reliable { doc /* First line.\nSecond line: \\n is literal. */ attribute id: string = "REQ-1"; attribute priority: uint = 2; } ${structure} satisfy Reliable by Demo.first; useCase Work for Demo {} verificationCase Check for Demo { verify Reliable; }`);
    assert.deepEqual(doc.diagnostics, []);
    assert.equal(documentationText(doc.parseResult.value.packages[0].elements[0]), 'First line.\nSecond line: \\n is literal.');
    assert.equal(doc.parseResult.value.packages[0].satisfactions[0].requirement.ref?.name,'Reliable');
});
test('formal docs and lexical comments stay separate and preserve owners', async () => {
    const doc = await parse(`// package note\ncomponent Demo {\n // component note\n doc /* Formal specification. // inside doc */\n function work() { // function note\n /* another note */\n } // trailing function note\n}`);
    assert.deepEqual(doc.diagnostics, []);
    const comments = modelComments(doc.parseResult.value);
    assert.equal(comments.length,5);
    assert.deepEqual(comments.map(c => 'name' in c.owner ? c.owner.name : ''),['P','Demo','work','work','work']);
    assert.deepEqual(comments.map(c=>c.kind),['line','line','line','block','line']);
});
test('doc-like text inside strings is not an annotation', async () => {
    const doc = await parse('requirement R { attribute value: string = "doc /* ordinary value */"; }');
    assert.deepEqual(doc.diagnostics,[]);
    assert.equal(documentationText(doc.parseResult.value.packages[0].elements[0]),undefined);
    assert.deepEqual(modelComments(doc.parseResult.value),[]);
});
test('multi-subject filters preserve independent instance paths and stable union', async () => {
    const doc=await parse(`${structure} view behavior fv { include Demo recursive where kind == "function" and not (path == "Demo.second.run"); include Worker.run; include Demo.first.run; }`);
    assert.deepEqual(doc.diagnostics,[]);
    const view=doc.parseResult.value.packages[0].elements.find(a.isView)!;
    assert.deepEqual(selectView(view).map(x=>x.path),['Demo.first.run','Worker.run']);
});
test('parenthesized filters, package recursion and empty result are supported',async()=>{
    const doc=await parse(`${structure} view selected gv { include P recursive where (kind == "component" or kind == "function") and name != "second"; } view empty gv { include Demo recursive where name == "absent"; }`);
    assert.deepEqual(doc.diagnostics,[]);
    const views=doc.parseResult.value.packages[0].elements.filter(a.isView);
    assert.ok(selectView(views[0]).some(x=>x.path==='Demo.second.run'));
    assert.deepEqual(selectView(views[1]),[]);
});
test('view paths preserve interface member navigation through a port',async()=>{
    const doc=await parse('interface senderReceiver Data version "1.0.0" { data value: int queued; } component def Sender { port output: Data sender optional; function sendValue() on start { send output.value(1); } } view member gv of Sender.output.value;');
    assert.deepEqual(doc.diagnostics,[]);
    assert.equal(selectView(doc.parseResult.value.packages[0].elements.find(a.isView)!)[0].path,'Sender.output.value');
});
for(const [title, body, code] of [
    ['two formal docs','requirement R { doc /* One */ doc /* Two */ }',undefined],
    ['unterminated doc','requirement R { doc /* broken',undefined],
    ['doc without block','requirement R { doc "text"; }',undefined],
    ['reserved doc identifier','requirement doc {}','SW003'],
    ['reserved doc enum literal','enum Flags { doc }','SW003'],
    ['comment keyword','requirement R { comment /* note */ }',undefined],
    ['requirement subject','requirement R for Demo {}',undefined],
    ['mutable requirement','requirement R { var count: int = 1; }',undefined],
    ['duplicate attribute','requirement R { attribute id: string = "a"; attribute id: string = "b"; }','SW002'],
    ['wrong attribute type','requirement R { attribute priority: int = "high"; }','SW023'],
    ['attribute private capture','requirement R { attribute value: int = Demo.secret; } component Demo { var secret: int = 1; }','SW022'],
    ['void attribute','requirement R { attribute value: void = 1; }','SW020'],
    ['unknown satisfaction source','requirement R {} satisfy R by Missing;','SW090'],
    ['case as satisfaction source','requirement R {} component Demo {} useCase Story for Demo {} satisfy R by Story;','SW090'],
    ['duplicate satisfaction','requirement R {} component Demo {} satisfy R by Demo; satisfy R by Demo;','SW090'],
    ['aliased duplicate satisfaction','requirement R {} component Demo {} satisfy R by Demo; satisfy R by P.Demo;','SW090'],
    ['useCase verification','requirement R {} component Demo {} useCase Story for Demo { verify R; }','SW091'],
    ['duplicate verification','requirement R {} component Demo {} verificationCase Check for Demo { verify R; verify R; }','SW091'],
    ['unknown requirement','component Demo {} verificationCase Check for Demo { verify Missing; }',undefined],
    ['old case keyword','component Demo {} case Story for Demo {}',undefined],
    ['uppercase view kind','component Demo {} view layout IV of Demo;',undefined],
    ['uppercase primitive','component Demo { var value: Int = 1; }',undefined],
    ['empty view block','view empty gv {}',undefined],
    ['unknown view selection','view broken gv { include Missing; }','SW080'],
    ['view of view','component Demo {} view first gv of Demo; view second gv of first;','SW080'],
    ['filter unknown field',`${structure} view invalid gv { include Demo recursive where owner == "x"; }`,'SW080'],
    ['filter non-Boolean',`${structure} view invalid gv { include Demo where name; }`,'SW023'],
    ['filter wrong operands',`${structure} view invalid gv { include Demo where name and true; }`,'SW023'],
    ['filter arithmetic',`${structure} view invalid gv { include Demo where 1 + 1 == 2; }`,'SW080'],
    ['view kind mismatch',`${structure} view invalid fv { include Demo; }`,'SW080']
] as const) test(`reject ${title}`,async()=>{const doc=await parse(body);assert.ok(doc.diagnostics?.some(d=>d.severity===1&&(!code||d.code===code)),JSON.stringify(doc.diagnostics));});
