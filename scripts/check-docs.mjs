import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { readStandardVersion } from './standard-version.mjs';
const root=resolve(import.meta.dirname,'..');
const ignored=new Set(['.git','node_modules','out','dist','.venv-pdf','tmp','history','__pycache__','generated','.codex','.agents']);
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.filter(e=>!ignored.has(e.name)).map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat();}
let snippets=0,links=0;const current=[];
for(const file of (await walk(root)).filter(f=>f.endsWith('.md'))){const text=await readFile(file,'utf8');for(const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){let path=m[1].split('#')[0].replace(/^<|>$/g,'');if(!path||/^[a-z]+:/i.test(path))continue;await stat(resolve(dirname(file),decodeURIComponent(path))).catch(()=>{throw Error(`Broken local link in ${file}: ${path}`)});links++;}
 const path=file.slice(root.length+1).replaceAll('\\','/');
 if(/(?:^docs\/(?:SWAML-1\.|MIGRATION_|RELEASE_|REVIEW_|SPECIFICATION_AUDIT)|^docs\/decisions\/(?!0016)|^showcase\/history)/.test(path))continue;
 current.push(path);
 for(const m of text.matchAll(/```swaml\r?\n([\s\S]*?)```/g)){const {Swaml}=createSwamlServices(EmptyFileSystem);const doc=await parseHelper(Swaml)(m[1],{validation:true});const errors=doc.diagnostics?.filter(d=>d.severity===1)??[];if(errors.length)throw Error(`Invalid complete SWAML fence in ${path}: ${JSON.stringify(errors)}`);snippets++;}
}
const grammar=await readFile(resolve(root,'src/language/swaml.langium'),'utf8'),productions=new Set([...grammar.matchAll(/^(?:(?:entry|hidden|terminal|type)\s+)*([A-Za-z]\w*)(?:\s+(?:returns|infers)\s+\w+)?\s*[:=]/gm)].map(m=>m[1]));
const inventory=JSON.parse(await readFile(resolve(root,'spec/kerml-mapping.json'),'utf8'));if(inventory.languageVersion!==await readStandardVersion())throw Error('Mapping edition mismatch');
const seen=new Set();for(const e of inventory.mapping){if(!productions.has(e.source)||seen.has(e.source)||!e.semantic||!e.normative?.startsWith('docs/spec/')||!Array.isArray(e.kernel)||!['element','grouping','reference','value','lowering','lexical'].includes(e.kind))throw Error('Invalid mapping '+e.source);await stat(resolve(root,e.normative));seen.add(e.source);}
if([...productions].some(p=>!seen.has(p)))throw Error('Missing grammar mapping');
console.log(`Documentation: ${links} local links, ${snippets} executable ${inventory.languageVersion} fences, ${seen.size} grammar/type families. Historical editions preserved.`);
