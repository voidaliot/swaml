import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EmptyFileSystem} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {viewCandidates} from '../out/src/language/presentation.js';
import {readStandardVersion} from './standard-version.mjs';
const root=new URL('../',import.meta.url),read=async p=>readFile(new URL(p,root),'utf8');
const n=JSON.parse(await read('spec/notation.json')),grammar=await read('src/language/swaml.langium'),keys=JSON.parse(await read('spec/keywords.json'));
assert.equal(n.languageVersion,await readStandardVersion());assert.equal(n.edition,n.languageVersion);assert.equal(keys.edition,n.languageVersion);
const productions=new Set([...grammar.matchAll(/^(?:(?:entry|hidden|terminal|type)\s+)*([A-Za-z]\w*)(?:\s+(?:returns|infers)\s+\w+)?\s*[:=]/gm)].map(m=>m[1])),terms=new Set([...grammar.matchAll(/'([A-Za-z]\w*)'/g)].map(m=>m[1]));
const exact=(actual,expected)=>assert.deepEqual([...actual].sort(),[...expected].sort());
exact(n.coverage.productions.map(x=>x.production),productions);exact(n.coverage.keywords.map(x=>x.term),terms);exact(keys.entries.map(x=>x.keyword),terms);
const ids=new Set(n.concepts.map(c=>c.id));assert.equal(ids.size,n.concepts.length);
for(const x of [...n.coverage.productions,...n.coverage.keywords])assert.ok(x.rationale&&x.concepts.every(c=>ids.has(c)));
for(const c of n.concepts){assert.ok(c.context&&c.syntax&&c.constraints.length&&c.rationale);const {Swaml}=createSwamlServices(EmptyFileSystem);const d=await parseHelper(Swaml)(await read(c.model),{validation:true});assert.deepEqual(d.diagnostics?.filter(x=>x.severity===1)??[],[]);const candidate=viewCandidates([d.parseResult.value]).find(s=>s.path===c.subject);assert.ok(candidate,c.subject);assert.equal(candidate.node.$cstNode.text,c.syntax,'Notation syntax source changed');const svg=await read(c.drawing);assert.ok(svg.includes('<svg')&&!svg.includes('<script'));const scene=JSON.parse(await read(c.scene));assert.ok(scene.width&&scene.height&&scene.elements.length);}
console.log(`${n.edition} notation: ${ids.size} original concepts, ${productions.size} grammar/type families and ${terms.size} keywords checked.`);
