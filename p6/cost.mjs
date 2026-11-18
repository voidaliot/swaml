// PROTOTYPE P4: cost of wakes and StateLoop. Runs every case of a model N times and prints wall time, steps and the
// prototype counters. Run it once per variant (env P6_NO_WAKES, P6_NO_STATELOOP, P6_HASH_FIRST).
// node p6/cost.mjs <model path> <cases.json key> [repetitions]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from './lib.mjs';
const base = pathToFileURL((process.env.P4_OUT ?? 'E:/t/sw-p7/out') + '/').href;
const { eachTest } = await import(base + 'src/simulation/simulator.js');
const { caseOptions } = await import(pathToFileURL('E:/t/sw-p7/scripts/simulation-cases.mjs').href);
const cases = JSON.parse(readFileSync('E:/t/sw-p7/examples/simulation/cases.json', 'utf8'));
const [file, key, reps = '5'] = process.argv.slice(2);
const p = await parse(readFileSync(file, 'utf8'), 'file:///cost.swaml');
if (p.errors.length) throw new Error(p.errors.slice(0, 3).map(e => e.message).join('; '));
const options = caseOptions(cases, key);
const variant = ['P6_NO_WAKES', 'P6_NO_STATELOOP', 'P6_HASH_FIRST'].filter(v => process.env[v]).join('+') || 'default';
let best = Infinity, totals;
for (let i = 0; i < Number(reps); i++) {
  const t0 = performance.now(), sum = { cases: 0, pass: 0, steps: 0, simNs: 0 };
  const stats = {};
  for (const r of eachTest([p.model], options)) {
    sum.cases++; if (r.result === 'pass') sum.pass++;
    sum.steps += r.run?.steps ?? 0; sum.simNs += r.run?.timeNs ?? 0;
    for (const [k, v] of Object.entries(r.run?.prototype ?? {})) stats[k] = (stats[k] ?? 0) + v;
  }
  const ms = performance.now() - t0;
  if (ms < best) { best = ms; totals = { ...sum, ...stats }; }
}
console.log(`${variant.padEnd(16)} best of ${reps}: ${best.toFixed(0)} ms wall; ${JSON.stringify(totals)}; looks per wall second ${(totals.looks / best * 1000).toFixed(0)}; config ns per look ${totals.looks ? (totals.configNs / totals.looks).toFixed(0) : 0}`);
