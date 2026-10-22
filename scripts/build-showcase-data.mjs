import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {posix} from 'node:path';
import {createHash} from 'node:crypto';
import {EmptyFileSystem,URI} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {isScenario,isRequirement,isOperation,isComponentDef,isWait} from '../out/src/language/generated/ast.js';
import {projectModel} from '../out/src/language/projection.js';
import {simulate} from '../out/src/simulation/simulator.js';
import {projectOperationTiming} from '../out/src/simulation/timing.js';
const root=new URL('../',import.meta.url), check=process.argv.includes('--check');
const source=await readFile(new URL('examples/02-realtime-controller.swaml',root),'utf8');
const {Swaml}=createSwamlServices(EmptyFileSystem);const doc=await parseHelper(Swaml)(source,{documentUri:URI.parse('memory:///examples/02-realtime-controller.swaml'),validation:true});
if(doc.diagnostics?.some(d=>d.severity===1))throw Error(JSON.stringify(doc.diagnostics));
const projection=projectModel([doc.parseResult.value]);const run=simulate([doc.parseResult.value],'Control::Demo',{untilNs:29000000});
const cases=doc.parseResult.value.packages.flatMap(p=>p.elements.filter(isScenario).map(c=>({name:c.name,kind:c.kind,steps:c.steps.map(s=>({name:s.name,kind:s.kind,source:s.source,target:s.target,via:s.connector,after:s.predecessor}))})));
const pkg=doc.parseResult.value.packages[0],controller=pkg.elements.find(x=>isComponentDef(x)&&x.name==='Controller'),regulate=controller.members.find(x=>isOperation(x)&&x.name==='regulate');
const requirements=pkg.elements.filter(isRequirement).map(r=>({name:r.name,attributes:r.attributes.map(a=>({name:a.name,type:a.type.primitive,value:a.value.$cstNode.text}))}));
const flow=regulate.body.statements.map(s=>({kind:s.$type,code:s.$cstNode.text}));
const data={cases,requirements,flow,languageVersion:'2.0',edition:'2.0.0',status:'released',model:'examples/02-realtime-controller.swaml',source,sha256:createHash('sha256').update(source).digest('hex'),projection,timing:projectOperationTiming(run),run:{profile:run.profile,root:run.root,status:run.status,untilNs:run.options.untilNs,trace:run.trace,stores:run.stores}};
const path=new URL('showcase/src/generated/model.json',root),text=JSON.stringify(data,null,2)+'\n';
if(check){if(await readFile(path,'utf8')!==text)throw Error('Stale site model/trace; run scripts/build-showcase-data.mjs');}
else{await mkdir(new URL('showcase/src/generated/',root),{recursive:true});await writeFile(path,text);for(const [input,output] of [['docs/notation/2.0/ports.svg','mixed-ports.svg'],['examples/02-realtime-controller.swaml','controller.swaml'],['docs/USER_GUIDE.md','usage-guide.md'],['docs/SIMULATION.md','simulation.md'],['docs/IMPLEMENTATION_STATUS.md','implementation-status.md'],['docs/AI_GUIDE.md','ai-guide.md'],['skills/swaml-author/SKILL.md','swaml-author-SKILL.md'],['skills/swaml-validate/SKILL.md','swaml-validate-SKILL.md']]){const dest=new URL('showcase/public/downloads/'+output,root);await mkdir(new URL('showcase/public/downloads/',root),{recursive:true});let content=await readFile(new URL(input,root),'utf8');if(input.endsWith('.md'))content=content.replace(/\]\(([^)]+)\)/g,(all,target)=>/^[a-z]+:|^#/.test(target)?all:'](https://github.com/voidaliot/swaml/blob/main/'+posix.normalize(posix.join(posix.dirname(input),target))+')');await writeFile(dest,content);}}
if (!check) {
  const downloads = new URL('showcase/public/downloads/', root);
  await writeFile(new URL('controller-options.json', downloads), JSON.stringify({untilNs: run.options.untilNs}, null, 2) + '\n');
  await writeFile(new URL('controller-run.json', downloads), JSON.stringify({
    ...run,
    source: {path: data.model, sha256: data.sha256},
  }, null, 2) + '\n');
}
console.log('Validated site source, seven source views and identified 2.0 trace '+(check?'checked.':'generated.'));
