import test from 'node:test';
import assert from 'node:assert/strict';
import { valid, workspace } from './helpers.js';
import { projectModel } from '../../src/language/projection.js';
import { semanticIndex } from '../../src/language/path-services.js';
import type { LangiumDocument } from 'langium';
import type { WorkspaceEdit } from 'vscode-languageserver';
function apply(d: LangiumDocument, edit: WorkspaceEdit): string {
    let text=d.textDocument.getText();
    for(const change of edit.documentChanges ?? []) if('textDocument' in change && change.textDocument.uri===d.uri.toString())
        for(const e of [...change.edits].sort((a,b)=>d.textDocument.offsetAt(b.range.start)-d.textDocument.offsetAt(a.range.start)))
            if('newText' in e) text=text.slice(0,d.textDocument.offsetAt(e.range.start))+e.newText+text.slice(d.textDocument.offsetAt(e.range.end));
    return text;
}

test('F03 rename rejects valid-but-captured package calls and preserves unrelated bindings', async()=>{
    const source='package Test{operation def bar() returns int{return 1;}component Demo{attribute n:int=0;operation foo() returns int{return 2;}operation boot(){n=foo()+bar();}schedule{on start boot();}}}';
    const r=await valid(source);
    const params={textDocument:{uri:r.doc.uri.toString()},position:r.doc.textDocument.positionAt(source.indexOf('foo()')),newName:'bar'};
    assert.equal(await r.Swaml.lsp.RenameProvider!.rename(r.doc,params),undefined);
    const edit=await r.Swaml.lsp.RenameProvider!.rename(r.doc,{...params,newName:'longerName'});
    assert.ok(edit);
    const next=apply(r.doc,edit);
    assert.ok(next.includes('longerName()+bar()'));
    await valid(next);
});

test('F03 rename rejects attribute capture of a local use',async()=>{
    const source='package Test{component Demo{attribute first:int=1;operation boot(){var other:int=2;var x:int=first+other;}}}';
    const r=await valid(source);
    const edit=await r.Swaml.lsp.RenameProvider!.rename(r.doc,{textDocument:{uri:r.doc.uri.toString()},position:r.doc.textDocument.positionAt(source.indexOf('first:')),newName:'other'});
    assert.equal(edit,undefined);
});

test('F09 enum head and literal have exact separate targets despite repeated names and trivia',async()=>{
    const source='package Test{enum E{End}component Demo{attribute n:E=Test :: E /* dot */ . End;}}';
    const r=await valid(source), index=semanticIndex([r.model]);
    const head=source.indexOf('E /*'),literal=source.lastIndexOf('End');
    for(const [offset,name,property] of [[head,'E','name'],[literal,'End','literals']] as const){
        const refs=index.filter(x=>!x.declaration&&r.doc.textDocument.offsetAt(x.range.start)===offset);
        assert.deepEqual(refs.map(x=>[x.symbol.name,x.symbol.property]),[[name,property]]);
    }
    const edit=await r.Swaml.lsp.RenameProvider!.rename(r.doc,{textDocument:{uri:r.doc.uri.toString()},position:r.doc.textDocument.positionAt(head),newName:'Mode'});
    assert.ok(edit);
    const next=apply(r.doc,edit);
    assert.ok(next.includes('Test :: Mode /* dot */ . End'));
    await valid(next);
});

test('F10 case via resolves the inherited routed connector even with repeated occurrence names',async()=>{
    const library='package Library{port def P{provides event ping();}component def A{port p:P;operation go(){publish p.ping();}schedule{on start go();}}component def B{reversed port p:P;operation take(){}schedule{on receive p.ping() take();}}component def Network{component sender:A;component receiver:B;connect link(sender.p,receiver.p);}}';
    const application='package Test{import Library;component Demo{component first:Network;component second:Network;use case Sample{publish item from first.sender.p.ping to first.receiver.p.ping via link;}}}';
    const r=await workspace([library,application]);
    assert.deepEqual(r.docs.flatMap(d=>d.diagnostics?.filter(x=>x.severity===1)??[]),[]);
    const d=r.docs[1],position=d.textDocument.positionAt(application.lastIndexOf('link'));
    const definitions=await r.Swaml.lsp.DefinitionProvider!.getDefinition(d,{textDocument:{uri:d.uri.toString()},position});
    assert.equal(definitions?.[0].targetUri,r.docs[0].uri.toString());
    const edit=await r.Swaml.lsp.RenameProvider!.rename(d,{textDocument:{uri:d.uri.toString()},position,newName:'route'});
    assert.ok(edit);
    assert.ok(apply(r.docs[0],edit).includes('connect route'));
    assert.ok(apply(d,edit).includes('via route'));
    const next=await workspace(r.docs.map(d=>apply(d,edit)));
    assert.deepEqual(next.docs.flatMap(d=>d.diagnostics?.filter(x=>x.severity===1)??[]),[]);
});

test('F11 package ownership covers every element without treating namespace prefixes as owners',async()=>{
    const r=await valid('package Test{}package Test::Nested{enum E{End}datatype D{n:int;}port def P{provides event ping();}operation def f(){}component def C{}component Demo{component child:C;attribute n:int=0;}}');
    const p=projectModel([r.model]), top=p.nodes.filter(n=>n.id.startsWith('Test::Nested::')&&!n.id.includes('.'));
    assert.equal(top.length,6);
    assert.ok(top.every(n=>n.owner==='Test::Nested'));
    assert.equal(p.nodes.find(n=>n.id==='Test::Nested')!.owner,undefined);
    assert.equal(p.nodes.find(n=>n.id==='Test::Nested::Demo.child')!.owner,'Test::Nested::Demo');
    assert.ok(top.every(n=>p.edges.some(e=>e.kind==='ownership'&&e.source==='Test::Nested'&&e.target===n.id)));
});
