import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EmptyFileSystem,URI} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {simulate} from '../out/src/simulation/simulator.js';
import {projectOperationTiming} from '../out/src/simulation/timing.js';
const root=new URL('../',import.meta.url),check=process.argv.includes('--check'),path='examples/17-function-timing.swaml',source=await readFile(new URL(path,root),'utf8');const {Swaml}=createSwamlServices(EmptyFileSystem),doc=await parseHelper(Swaml)(source,{documentUri:URI.parse('memory:///'+path),validation:true});if(doc.diagnostics?.some(d=>d.severity===1))throw Error('Invalid timing model');
const run=simulate([doc.parseResult.value],'Timing::Demo',{untilNs:19000000}),data={languageVersion:'2.0',source:path,sha256:createHash('sha256').update(source).digest('hex'),root:run.root,profile:run.profile,options:run.options,declared:{periodNs:5000000,deadlineNs:3000000,waitNs:1000000},observed:projectOperationTiming(run)};const text=JSON.stringify(data,null,2)+'\n',out=new URL('spec/function-timing-demo.json',root);if(check){if(await readFile(out,'utf8')!==text)throw Error('Stale identified timing projection');}else await writeFile(out,text);console.log('2.0 declared/observed timing '+(check?'checked.':'generated.'));
