// PROTOTYPE P4/P6: runs every test (or the named ones) of hand-written models and prints the observed traces.
// node p6/cases.mjs <model.swaml> [test-substring] [--kinds a,b] [--subjects x,y] [--writes a,b] [--until ns]
import { readFileSync } from 'node:fs';
import { load, runCase, show, summary, title, MODELS } from './lib.mjs';
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const valued = new Set(['--kinds', '--subjects', '--writes', '--until', '--steps'].map(o => args.indexOf(o) + 1).filter(i => i > 0));
const [file, filter] = args.filter((x, i) => !x.startsWith('--') && !valued.has(i));
const text = readFileSync(file.includes(':') ? file : `${MODELS}/${file}`, 'utf8');
const p = await load(file);
for (const w of p.warnings) console.log(`warning line ${w.range.start.line + 1}: ${w.message}`);
const pkg = /package\s+(\w+|'[^']+')/.exec(text)[1].replace(/'/g, '');
const names = [...text.matchAll(/^\s*test '([^']+)'/gm)].map(m => m[1]).filter(n => !filter || n.includes(filter));
const kinds = opt('--kinds')?.split(','), subjects = opt('--subjects')?.split(','), writes = opt('--writes')?.split(',');
for (const n of names) {
  title(`${file}: ${n}`);
  const t0 = performance.now();
  const r = runCase([p.model], `${pkg}::${n}`, { untilNs: Number(opt('--until') ?? 20e9), maxSteps: Number(opt('--steps') ?? 5000000) });
  const ms = performance.now() - t0;
  console.log(`  result ${r.result}${r.reason ? ' ' + r.reason : ''}${r.message ? ': ' + r.message : ''}`);
  if (r.run) {
    show(r.run, { ...(kinds ? { kinds } : {}), subjects, writes });
    console.log(`  ${summary(r.run)}; ${ms.toFixed(1)} ms wall`);
  }
}
