import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { EmptyFileSystem } = await import(pathToFileURL('E:/t/sw-p1/node_modules/langium/lib/index.js').href);
const { parseHelper } = await import(pathToFileURL('E:/t/sw-p1/node_modules/langium/lib/test/index.js').href);
for (const v of [1, 2, 3]) {
  const res = [];
  for (const [out, file] of [['out-base', `E:/t/sw-p1/p1/synthetic/syn${v}.swaml`], ['out', `E:/t/p1-scratch/migrated/p1/synthetic/syn${v}.swaml`]]) {
    const { createSwamlServices } = await import(pathToFileURL(`E:/t/sw-p1/${out}/src/language/swaml-module.js`).href);
    const { simulate } = await import(pathToFileURL(`E:/t/sw-p1/${out}/src/simulation/simulator.js`).href);
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const d = await parseHelper(Swaml)(readFileSync(file, 'utf8'), { documentUri: `file:///syn${v}${out}.swaml`, validation: true });
    const errs = d.diagnostics.filter(x => x.severity === 1); if (errs.length) { console.log(out, errs.map(e => e.message)); continue; }
    const r = simulate([d.parseResult.value], 'Syn', { untilNs: 1e8 });
    res.push({ stores: JSON.stringify(r.stores.m), states: r.trace.filter(e => e.kind === 'state').map(e => e.state + '@' + e.timeNs / 1e6).join(' '), status: r.status });
  }
  console.log(`syn${v}`, JSON.stringify(res[0]) === JSON.stringify(res[1]) ? 'SAME' : 'DIFF', JSON.stringify(res));
}
