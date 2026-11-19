import {existsSync,readFileSync} from 'node:fs';
import {editionMentions} from './site-edition.mjs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {EmptyFileSystem} from 'langium';
import {parseHelper} from 'langium/test';
import {createSwamlServices} from '../out/src/language/swaml-module.js';
import {isView} from '../out/src/language/generated/ast.js';
import {REFERENCE_PROFILE} from '../out/src/simulation/simulator.js';
const root=new URL('../',import.meta.url);execFileSync(process.execPath,[fileURLToPath(new URL('scripts/build-showcase-data.mjs',root)),'--check'],{stdio:'inherit'});
const source=await readFile(new URL('examples/02-realtime-controller.swaml',root),'utf8'),{Swaml}=createSwamlServices(EmptyFileSystem),doc=await parseHelper(Swaml)(source,{validation:true});assert.deepEqual(doc.diagnostics?.filter(d=>d.severity===1)??[],[]);
assert.deepEqual(doc.parseResult.value.packages[0].elements.filter(isView).map(v=>v.definition.ref.name).sort(),['General','Interconnect','Case','Sequence','Grid','Flow','Timing'].sort());
const data=JSON.parse(await readFile(new URL('showcase/src/generated/model.json',root),'utf8'));assert.equal(data.run.profile,REFERENCE_PROFILE);assert.equal(data.run.stores['Demo.heater'].power,.25);assert.equal(data.projection.nodes.filter(n=>n.kind==='component'&&/^Control::Demo\.[^.]+$/.test(n.id)).length,3);console.log(data.edition+' site model, seven view definitions and observed final store checked.');
// The site links only to a published PDF: the edition's own when it is released, otherwise the latest published one.
const pdf=edition=>new URL(`output/pdf/SWAML-${edition}-Specification.pdf`,root);
assert.equal(data.status,existsSync(pdf(data.edition))?'released':'unreleased candidate','site status follows the publication of its edition');
assert.ok(existsSync(pdf(data.publishedEdition)),`site links to a missing PDF for ${data.publishedEdition}`);
if(data.status==='released')assert.equal(data.publishedEdition,data.edition);

// The front page presents the current edition only: no other edition number appears in its text, data or downloads
// (the Node.js/npm requirement is not an edition). check-site-artifact.mjs applies the same rule to the built downloads.
for (const file of ['showcase/src/App.tsx', 'showcase/src/Timing.tsx', 'showcase/index.html', 'showcase/src/generated/model.json']) {
  const other = editionMentions(await readFile(new URL(file, root), 'utf8')).filter(v => v !== data.edition);
  assert.deepEqual(other, [], `${file} mentions another edition than ${data.edition}`);
}
// Every code excerpt on the front page comes from the site data, and the data takes it line by line from an example
// that the examples gate (scripts/validate-examples.mjs) validates.
const app = await readFile(new URL('showcase/src/App.tsx', root), 'utf8');
assert.doesNotMatch(app, /<Code\s+text=\{?\s*["'`]/, 'A front-page code excerpt is written in App.tsx instead of taken from a validated example');
const validated = path => /^examples\/(?!invalid\/)[^]*\.swaml$/.test(path) && existsSync(new URL(path, root));
const fromSource = (excerpt, path) => {
  assert.ok(validated(path), `${path} is not validated by the examples gate`);
  const lines = readFileSync(new URL(path, root), 'utf8').split(/\r?\n/).map(l => l.trim()), want = excerpt.split('\n').map(l => l.trim()).filter(Boolean);
  const start = lines.findIndex((l, i) => want.every((w, j) => lines.slice(i).filter(Boolean)[j] === w));
  assert.ok(start >= 0, `Front-page excerpt is not taken from ${path}: ${want[0]}`);
};
const excerpts = [...data.projection.nodes.filter(n => n.code).map(n => n.code), ...data.flow.map(f => f.code), data.source];
for (const code of excerpts) fromSource(code, data.model);
fromSource(data.states.code, data.states.model);
assert.equal(data.states.result, 'pass', 'The front-page states test must pass');
console.log(`Front page: ${excerpts.length + 1} code excerpts from validated examples; edition ${data.edition} only.`);
