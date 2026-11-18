// PROTOTYPE P4/P6 harness library (throwaway, never product code): loads a hand-written model, runs it, prints the
// controller's observable behaviour. Build first: npm run build. Env P4_OUT overrides the build dir (default E:/t/sw-p6/out).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const outDir = process.env.P4_OUT ?? 'E:/t/sw-p6/out';
const base = pathToFileURL(outDir + '/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
export const { simulate, runCase, projectOperationTiming } = await import(base + 'src/simulation/simulator.js');
export const MODELS = process.env.P6_MODELS ?? 'E:/GitHub/swaml-vsc-ext/.temp/kept/states-p6/models';
export const fmt = ns => ns >= 1e9 && ns % 1e6 === 0 ? `${ns / 1e9}s` : ns % 1e6 === 0 ? `${ns / 1e6}ms` : `${ns / 1e6}ms`;
export async function parse(text, uri = `file:///m-${Math.random().toString(36).slice(2)}.swaml`) {
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(text, { documentUri: uri, validation: true });
  const diags = d.diagnostics ?? [];
  return { model: d.parseResult.value, errors: diags.filter(x => x.severity === 1), warnings: diags.filter(x => x.severity === 2), parserErrors: d.parseResult.parserErrors };
}
export async function load(file) {
  const text = readFileSync(file.includes(':') ? file : `${MODELS}/${file}`, 'utf8');
  const p = await parse(text, `file:///${file.replace(/^.*[\\/]/, '')}`);
  if (p.parserErrors.length) throw new Error(`${file}: parse errors: ` + p.parserErrors.map(e => `${e.token?.startLine}: ${e.message}`).join('; '));
  if (p.errors.length) throw new Error(`${file}: ` + p.errors.map(e => `${e.range.start.line + 1}: ${e.message}`).join('\n  '));
  return p;
}
/** Default event filter: everything observable about states, values and the machine's activation. */
export const KINDS = ['state', 'wake', 'release', 'skip', 'periodicEnd', 'discardInput', 'complete', 'failure', 'violation', 'write', 'send', 'publish', 'sample', 'timer', 'receiveWait', 'assert'];
export function show(r, { kinds = KINDS, subjects, writes, quiet = false } = {}) {
  const lines = [];
  for (const e of r.trace) {
    if (!kinds.includes(e.kind)) continue;
    const s = String(e.subject);
    if (subjects && !subjects.some(x => s.startsWith(x))) continue;
    if (e.kind === 'write' && (e.scope === 'local' || writes && !writes.some(w => s.endsWith('.' + w)))) continue;
    if (e.kind === 'receiveWait' && !kinds.includes('receiveWait!')) continue;
    let d = '';
    if (e.state !== undefined) d += ' ' + e.state;
    if (e.stay) d += ' stay';
    if (e.trigger) d += ` (via ${e.trigger.replace(/^.*?\//, '')})`;
    if (e.reason) d += ' ' + e.reason;
    if (e.code) d += ' ' + e.code;
    if (e.value !== undefined) d += ' = ' + JSON.stringify(e.value);
    if (e.args) d += '(' + e.args.map(x => JSON.stringify(x)).join(', ') + ')';
    if (e.attributes) d += ' by ' + e.writer + ' writing ' + e.attributes.join(',');
    if (e.cell) d += ' by sample ' + e.cell;
    if (e.pending) d += ' (pending: written while busy)';
    if (e.release !== undefined) d += ' #' + e.release;
    if (e.activation && ['release', 'periodicEnd'].includes(e.kind)) d += ' ' + e.activation;
    if (e.kind === 'assert') d += e.passed ? ' passed' : ' FAILED';
    lines.push(`${fmt(e.timeNs).padStart(8)} ${e.kind} ${s}${d}`);
  }
  if (!quiet) for (const l of lines) console.log('  ' + l);
  return lines;
}
export function summary(r) {
  const p = r.prototype ?? {};
  return `status ${r.status} at ${fmt(r.timeNs)}, steps ${r.steps}; looks ${p.looks} (arrival ${p.arrivalLooks}, message ${p.messageLooks}, timer ${p.timerLooks}, wake ${p.wakeLooks}, release ${p.releaseLooks}); wakes ${p.wakes} (same value ${p.sameValueWakes}), pending ${p.pendingWakes}; configs ${p.configs}`;
}
export function title(t) { console.log(`\n## ${t}`); }
