// PROTOTYPE P1r measurement (copy of p1/measure.mjs reading E:/t/sw-p4) harness (throwaway, never product code).
// node measure.mjs <outDir abs> <sourceRoot abs> <result.json>
// Runs the 253-result corpus of the states-in-flow design (runs.json, every case of every example, extended 2.2 sets),
// reading model texts from sourceRoot (a migrated mirror) and everything else from the repository.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = 'E:/t/sw-p4';
const [outDir, sourceRoot, resultFile] = process.argv.slice(2);
const base = pathToFileURL(outDir + '/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const { simulate, runCase, eachTest } = await import(base + 'src/simulation/simulator.js');
const { caseOptions } = await import(pathToFileURL(join(root, 'scripts/simulation-cases.mjs')).href);
const read = p => readFileSync(join(root, p), 'utf8');
const readModel = p => existsSync(join(sourceRoot, p)) ? readFileSync(join(sourceRoot, p), 'utf8') : read(p);
const extText = (f, i, text) => { const p = join(sourceRoot, 'ext', f, `${i}.swaml`); return existsSync(p) ? readFileSync(p, 'utf8') : text; };
const summarize = run => {
  const trace = run.trace.map(({ profile: _p, languageVersion: _l, ordinal: _o, ...rest }) => rest), kinds = {};
  for (const e of trace) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  return { status: run.status, stores: run.stores, machines: run.machines, traceLength: trace.length, kinds, trace };
};
const caseSum = r => ({ result: r.result, reason: r.reason ?? null, message: r.message ?? null, ...(r.run ? summarize(r.run) : {}) });
const invalid = {};
async function load(uri, text) {
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(text, { documentUri: uri, validation: true });
  const errors = (d.diagnostics ?? []).filter(x => x.severity === 1);
  if (errors.length) invalid[uri] = errors.map(e => `${e.range.start.line + 1}: ${e.message}`).slice(0, 5);
  return errors.length ? undefined : [d.parseResult.value];
}
function walk(dir) {
  const out = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.name === 'invalid') continue;
    if (e.isDirectory()) out.push(...walk(dir + e.name + '/'));
    else if (e.name.endsWith('.swaml')) out.push(dir + e.name);
  }
  return out;
}
const results = {};
const attempt = (id, f) => { try { results[id] = f(); } catch (e) { results[id] = { threw: String(e?.message ?? e) }; } };
const runs = JSON.parse(read('examples/simulation/runs.json')), cases = JSON.parse(read('examples/simulation/cases.json'));
for (const run of runs) {
  const models = await load(`file:///${run.model}`, readModel(run.model));
  if (!models) { results[`run ${run.case ?? run.target} of ${run.model}`] = { invalid: true }; continue; }
  const options = JSON.parse(read(run.options));
  attempt(`run ${run.case ?? run.target} of ${run.model}`, () => run.case ? caseSum(runCase(models, run.case, options)) : summarize(simulate(models, run.target, options)));
}
for (const model of walk('examples/').sort()) {
  const models = await load(`file:///${model}`, readModel(model));
  if (!models) { results[`cases of ${model}`] = { invalid: true }; continue; }
  try { for (const r of eachTest(models, caseOptions(cases, model))) results[`case ${r.case} of ${model}`] = caseSum(r); }
  catch (e) { results[`cases of ${model}`] = { threw: String(e?.message ?? e) }; }
}
const dir = 'test/fixtures/compatibility-2-2-extended/';
for (const f of readdirSync(join(root, dir)).filter(f => f.startsWith('models')).sort()) {
  const ms = JSON.parse(read(dir + f)).models;
  for (const [i, m] of ms.entries()) {
    const models = await load(`file:///${i + 1}.swaml`, extText(f, i, m.text));
    if (!models) { if (m.target || m.tests?.length) results[`ext ${f} ${m.name} invalid`] = { invalid: true }; continue; }
    if (m.target) attempt(`ext ${f} ${m.name} run`, () => summarize(simulate(models, m.target, { untilNs: 100000000 })));
    for (const t of m.tests ?? []) attempt(`ext ${f} ${m.name} case ${t}`, () => caseSum(runCase(models, t, { untilNs: 100000000 })));
  }
}
writeFileSync(resultFile, JSON.stringify(results));
writeFileSync(resultFile.replace(/\.json$/, '.invalid.json'), JSON.stringify(invalid, null, 1));
console.log(`${Object.keys(results).length} results -> ${resultFile}; invalid documents ${Object.keys(invalid).length}`);
