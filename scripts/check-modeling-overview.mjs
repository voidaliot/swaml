import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),data=JSON.parse(await read('spec/modeling-overview.json')),figures=JSON.parse(await read('spec/graphical-examples.json'));
assert.equal(data.languageVersion,'2.0');assert.deepEqual(data.stages.map(s=>[s.source,s.subject,s.diagram]),figures.examples.map(f=>[f.model,f.subject,f.svg]));for(const s of data.stages)assert.ok((await read(s.diagram)).includes('<svg'));console.log('2.0 modeling overview uses the checked model/figure manifest.');
