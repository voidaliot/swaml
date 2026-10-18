import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, documentationText, modelComments, selectView } from '../out/src/language/swaml-module.js';
import * as a from '../out/src/language/generated/ast.js';
const path = new URL('../spec/traceability-demo.json', import.meta.url);
const source = await readFile(new URL('../examples/16-requirements-and-views.swaml', import.meta.url),'utf8');
const { Swaml } = createSwamlServices(EmptyFileSystem);
const doc = await parseHelper(Swaml)(source,{validation:true});
assert.deepEqual(doc.diagnostics,[]);
const model = doc.parseResult.value, pkg = model.packages[0];
const comments = modelComments(model);
const result = {
    model:'examples/16-requirements-and-views.swaml',
    views:pkg.elements.filter(a.isView).map(view=>({name:view.name,kind:view.kind,source:view.$cstNode.text,elements:selectView(view).map(c=>{
        const n = a.isInstance(c.node) ? c.node.definition.ref : c.node;
        return {path:c.path,name:c.name,kind:c.kind,doc:documentationText(c.node)??documentationText(n)??'',comments:comments.filter(c=>c.owner===n).map(c=>c.text),attributes:a.isRequirement(n)?n.attributes.map(v=>({name:v.name,type:v.type.$cstNode.text,value:v.value.$cstNode.text})):[],source:c.node.$cstNode.text};
    })})),
    relations:[...pkg.satisfactions.map(r=>({source:r.source,target:r.requirement.ref.name,kind:'satisfy'})),...pkg.elements.filter(a.isScenario).flatMap(c=>[{source:c.name,target:c.root.ref.name,kind:'of'},...c.verifications.map(r=>({source:c.name,target:r.requirement.ref.name,kind:'verify'}))])]
};
const text=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(await readFile(path,'utf8'),text,'Traceability demo is stale; run node scripts/build-traceability-demo.mjs');
else await writeFile(path,text);
console.log(`Traceability demo: ${result.views.length} parsed views, docs/comments, attributes and ${result.relations.length} resolved relations.`);
