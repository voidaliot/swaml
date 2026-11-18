// PROTOTYPE P6: runs every case of the door showcase with the original periodic operations and with MirrorHeater.tick and
// SupplyMonitor.classify rewritten as periodic machines; compares verdicts, final stores and the components' sends/writes.
// node p6/door.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse, MODELS } from './lib.mjs';
const base = pathToFileURL((process.env.P4_OUT ?? 'E:/t/sw-p6/out') + '/').href;
const { eachTest } = await import(base + 'src/simulation/simulator.js');
const { caseOptions } = await import(pathToFileURL('E:/t/sw-p6/scripts/simulation-cases.mjs').href);
const cases = JSON.parse(readFileSync('E:/t/sw-p6/examples/simulation/cases.json', 'utf8'));
const key = 'examples/showcase/autosar-classic-door-controller.swaml';
const options = caseOptions(cases, key);
async function runAll(text, label) {
  const p = await parse(text, 'file:///door.swaml');
  if (p.errors.length || p.parserErrors.length) throw new Error(label + ': ' + [...p.parserErrors.map(e => e.message), ...p.errors.map(e => `${e.range.start.line + 1}: ${e.message}`)].slice(0, 5).join('\n'));
  const out = {}, t0 = performance.now();
  for (const r of eachTest([p.model], options)) out[r.case] = r;
  return { out, ms: performance.now() - t0 };
}
const A = await runAll(readFileSync('E:/t/sw-p6/' + key, 'utf8'), 'original');
const B = await runAll(readFileSync(`${MODELS}/door-periodic-rewrite.swaml`, 'utf8'), 'rewrite');
const watched = ['dcu.heater', 'dcu.supply'];
// Observable behaviour of the rewritten components: their sends and attribute writes (not state/release bookkeeping).
// Writes count only when they change the value (the original rewrites equal values every release; the machine writes on change).
const initial = { 'dcu.supply.undervoltage': false, 'dcu.supply.lowSamples': 0, 'dcu.supply.supplyMv': 13500, 'dcu.heater.heating': false, 'dcu.heater.requested': false };
const obs = r => { const last = { ...initial }; return (r.run?.trace ?? []).filter(e => {
    if (!watched.some(w => String(e.subject).startsWith(w + '.'))) return false;
    if (e.kind === 'send' || e.kind === 'publish') return true;
    if (e.kind !== 'write' || e.scope === 'local' || e.subject.endsWith('.heaterTicks')) return false;
    const changed = JSON.stringify(last[e.subject]) !== JSON.stringify(e.value); last[e.subject] = e.value; return changed; })
  .map(e => `${e.timeNs} ${e.kind} ${e.subject} ${JSON.stringify(e.value ?? e.args)}`); };
let same = 0;
for (const id of Object.keys(A.out)) {
  const x = A.out[id], y = B.out[id];
  const sx = JSON.stringify(watched.map(w => ({ ...x.run?.stores[w], heaterTicks: undefined }))), sy = JSON.stringify(watched.map(w => ({ ...y.run?.stores[w], heaterTicks: undefined })));
  const ox = obs(x), oy = obs(y);
  const other = JSON.stringify(Object.entries(x.run?.stores ?? {}).filter(([k]) => !watched.includes(k))) === JSON.stringify(Object.entries(y.run?.stores ?? {}).filter(([k]) => !watched.includes(k)));
  if (x.result === y.result && sx === sy && ox.join('\n') === oy.join('\n') && other) { same++; continue; }
  console.log(`DIFF ${id}: ${x.result} -> ${y.result}; watched stores ${sx === sy ? 'same' : sx + ' -> ' + sy}; other stores ${other ? 'same' : 'differ'}`);
  let i = 0; while (i < ox.length && ox[i] === oy[i]) i++;
  for (let j = i; j < Math.min(i + 6, Math.max(ox.length, oy.length)); j++) console.log(`   A ${ox[j] ?? ''}\n   B ${oy[j] ?? ''}`);
}
console.log(`${Object.keys(A.out).length} cases; identical (verdict, all final stores, sends and attribute writes of heater and supply, in order): ${same}`);
console.log(`wall: original ${A.ms.toFixed(0)} ms, rewrite ${B.ms.toFixed(0)} ms`);
