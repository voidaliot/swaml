import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EmptyFileSystem} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {viewCandidates} from '../out/src/language/presentation.js';
import {readStandardVersion} from './standard-version.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),manifest=JSON.parse(await read('spec/graphical-examples.json'));assert.equal(manifest.languageVersion,await readStandardVersion());
for(const f of manifest.examples){const {Swaml}=createSwamlServices(EmptyFileSystem);const doc=await parseHelper(Swaml)(await read(f.model),{validation:true});assert.deepEqual(doc.diagnostics?.filter(d=>d.severity===1)??[],[]);assert.ok(viewCandidates([doc.parseResult.value]).some(x=>x.path===f.subject));assert.ok((await read(f.svg)).includes('<svg'));assert.ok(JSON.parse(await read(f.scene)).elements.length);}
console.log('Worked '+manifest.languageVersion+' diagram/model subjects checked.');
