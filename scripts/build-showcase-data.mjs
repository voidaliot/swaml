import {readStandardVersion} from './standard-version.mjs';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EmptyFileSystem,URI} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {isScenario,isRequirement,isOperation,isComponentDef,isWait} from '../out/src/language/generated/ast.js';
import {projectModel} from '../out/src/language/projection.js';
import {associationPairs} from '../out/src/language/semantic.js';
import {runTests,simulate} from '../out/src/simulation/simulator.js';
import {projectOperationTiming} from '../out/src/simulation/timing.js';
const standardVersion=await readStandardVersion();
const root=new URL('../',import.meta.url), check=process.argv.includes('--check');
// An edition is released when its PDF and manifest are published under output/pdf. An unreleased candidate
// links to the latest published MAJOR.MINOR edition instead, never to a tag or PDF that does not exist.
const published=edition=>['pdf','manifest.json'].every(suffix=>existsSync(new URL(`output/pdf/SWAML-${edition}-Specification.${suffix}`,root)));
const editionKey=edition=>edition.split('.').map(Number);
const publishedEditions=readdirSync(new URL('output/pdf/',root)).map(f=>/^SWAML-(\d+\.\d+)-Specification\.pdf$/.exec(f)?.[1]).filter(e=>e&&published(e)).sort((x,y)=>{const [a,b]=[editionKey(x),editionKey(y)];return a[0]-b[0]||a[1]-b[1];});
const publication={edition:published(standardVersion)?standardVersion:publishedEditions.at(-1),status:published(standardVersion)?'released':'unreleased candidate'};
if(!publication.edition)throw Error('No published MAJOR.MINOR edition under output/pdf');
const source=await readFile(new URL('examples/02-realtime-controller.swaml',root),'utf8');
const {Swaml}=createSwamlServices(EmptyFileSystem);const doc=await parseHelper(Swaml)(source,{documentUri:URI.parse('memory:///examples/02-realtime-controller.swaml'),validation:true});
if(doc.diagnostics?.some(d=>d.severity===1))throw Error(JSON.stringify(doc.diagnostics));
const projection=projectModel([doc.parseResult.value]);const run=simulate([doc.parseResult.value],'Control::Demo',{untilNs:29000000});
// Each test runs as a script in its own package run; the site shows its bounded result.
const results=new Map(runTests([doc.parseResult.value],{untilNs:1000000000}).map(r=>[r.case,r.result]));
// The Case view draws each subject as a boundary, associated occurrences as actors outside it and satisfy/verify links.
const typeOf=u=>u?.definition?.$refText??null;
const cases=doc.parseResult.value.packages.flatMap(p=>p.elements.filter(isScenario).map(c=>({name:c.name,kind:c.kind==='test'?'test':'use case',subject:c.subject?.$refText??null,subjectType:typeOf(c.subject?.ref),actors:p.associations.flatMap(associationPairs).filter(a=>a.target.ref===c).map(a=>({name:a.occurrence.$refText,type:typeOf(a.occurrence.ref)})),verifies:p.verifications.filter(v=>v.test.ref===c).map(v=>v.requirement.$refText),result:results.get(p.name+'::'+c.name)})));
const satisfactions=doc.parseResult.value.packages.flatMap(p=>p.satisfactions.map(s=>({requirement:s.requirement.$refText,design:s.design})));
// The Sequence view shows the first observed offer on each connection of the reference run.
const sequence=run.trace.filter(t=>t.kind==='offer').filter((t,i,all)=>all.findIndex(x=>x.subject===t.subject)===i).map(t=>({member:t.member,source:t.sourcePort.split('.').slice(1).join('.'),target:t.targetPort.split('.').slice(1).join('.'),via:t.subject.split('.').at(-1),timeNs:t.timeNs}));
const pkg=doc.parseResult.value.packages[0],controller=pkg.elements.find(x=>isComponentDef(x)&&x.name==='Controller'),regulate=controller.members.find(x=>isOperation(x)&&x.name==='regulate');
const requirements=pkg.elements.filter(isRequirement).map(r=>({name:r.name,attributes:r.attributes.map(a=>({name:a.name,type:a.type.primitive,value:a.value.$cstNode.text}))}));
const flow=regulate.body.statements.map(s=>({kind:s.$type,code:s.$cstNode.text}));
// States as steps of the flow: a validated example and one of its tests, run by the reference interpreter.
const statesModel='examples/54-interior-light.swaml',statesTest='A door opening restarts the courtesy time';
const statesSource=await readFile(new URL(statesModel,root),'utf8');
const statesDoc=await parseHelper(Swaml)(statesSource,{documentUri:URI.parse('memory:///'+statesModel),validation:true});
if(statesDoc.diagnostics?.some(d=>d.severity===1))throw Error(JSON.stringify(statesDoc.diagnostics));
const statesPkg=statesDoc.parseResult.value.packages[0],light=statesPkg.elements.find(x=>isComponentDef(x)&&x.name==='Light'),lightRun=light.members.find(x=>isOperation(x)&&x.name==='run');
// An excerpt is whole source lines, dedented; check-showcase.mjs matches it against the validated file.
const excerpt=node=>{const lines=statesSource.split(/\r?\n/).slice(node.$cstNode.range.start.line,node.$cstNode.range.end.line+1),indent=Math.min(...lines.filter(l=>l.trim()).map(l=>/^ */.exec(l)[0].length));return lines.map(l=>l.slice(indent)).join('\n');};
const [statesCase]=runTests([statesDoc.parseResult.value],{untilNs:1000000000},{package:statesPkg.name,case:statesTest});
if(statesCase?.result!=='pass')throw Error('The site states example must pass: '+statesTest);
const statesRun=statesCase.run;
const observed=e=>e.kind==='publish'||e.kind==='state'||e.kind==='write'&&e.scope==='attribute';
const states={model:statesModel,sha256:createHash('sha256').update(statesSource).digest('hex'),component:light.name,operation:lightRun.name,code:excerpt(lightRun),test:statesTest,result:statesCase.result,profile:statesRun.profile,timeNs:statesRun.timeNs,
  observations:statesRun.trace.filter(observed).map(e=>({ordinal:e.ordinal,timeNs:e.timeNs,kind:e.kind,subject:e.kind==='publish'?e.subject.split('.').slice(1).join('.'):e.subject,value:e.kind==='state'?e.state+(e.trigger?' (entered again)':''):e.kind==='write'?e.value:e.args?.[0]??null})),
  stores:statesRun.stores};
const data={states,cases,satisfactions,sequence,requirements,flow,languageVersion:standardVersion,edition:standardVersion,status:publication.status,publishedEdition:publication.edition,model:'examples/02-realtime-controller.swaml',source,sha256:createHash('sha256').update(source).digest('hex'),projection,timing:projectOperationTiming(run),run:{profile:run.profile,target:run.target,status:run.status,untilNs:run.options.untilNs,trace:run.trace,stores:run.stores}};
const path=new URL('showcase/src/generated/model.json',root),text=JSON.stringify(data,null,2)+'\n';
if(check){if(await readFile(path,'utf8')!==text)throw Error('Stale site model/trace; run scripts/build-showcase-data.mjs');}
else{await mkdir(new URL('showcase/src/generated/',root),{recursive:true});await writeFile(path,text);
// Downloads are current-edition sources only; the guides are read on the site's specification pages (spec/).
const downloadsDir=new URL('showcase/public/downloads/',root);await rm(downloadsDir,{recursive:true,force:true});await mkdir(downloadsDir,{recursive:true});
for(const [input,output] of [['docs/notation/'+standardVersion+'/ports.svg','mixed-ports.svg'],['examples/02-realtime-controller.swaml','controller.swaml'],[statesModel,'interior-light.swaml']])await writeFile(new URL(output,downloadsDir),await readFile(new URL(input,root),'utf8'));}
if (!check) {
  const downloads = new URL('showcase/public/downloads/', root);
  await writeFile(new URL('controller-options.json', downloads), JSON.stringify({untilNs: run.options.untilNs}, null, 2) + '\n');
  await writeFile(new URL('controller-run.json', downloads), JSON.stringify({
    ...run,
    source: {path: data.model, sha256: data.sha256},
  }, null, 2) + '\n');
  await writeFile(new URL('interior-light-run.json', downloads), JSON.stringify({
    case: statesCase.case, result: statesCase.result, ...statesRun,
    source: {path: statesModel, sha256: states.sha256},
  }, null, 2) + '\n');
}
console.log('Validated site source, seven source views and identified '+standardVersion+' trace '+(check?'checked.':'generated.'));
