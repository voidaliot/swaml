import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cli=fileURLToPath(new URL('out/src/cli/main.js',root));
async function walk(path){const files=[];for(const e of await readdir(new URL(path,root),{withFileTypes:true})){if(e.name==='invalid')continue;if(e.isDirectory())files.push(...await walk(path+e.name+'/'));else if(e.name.endsWith('.swaml'))files.push(path+e.name);}return files;}
const positive=await walk('examples/');const run=files=>spawnSync(process.execPath,[cli,'--json',...files.map(f=>fileURLToPath(new URL(f,root)))],{encoding:'utf8',timeout:30000});
const checked=run(positive);if(checked.status!==0)throw Error(checked.stderr||checked.stdout);const report=JSON.parse(checked.stdout);
for(const name of (await readdir(new URL('examples/invalid/',root))).filter(f=>f.endsWith('.swaml'))){const r=run(['examples/invalid/'+name]);if(r.status!==1||!JSON.parse(r.stdout).errorCount)throw Error('Negative example was not rejected: '+name);}
console.log(`Validated ${positive.length} complete examples and rejected both negative fixtures; ${report.diagnostics.filter(d=>d.severity===2).length} documented warning(s).`);
