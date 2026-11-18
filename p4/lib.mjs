// PROTOTYPE P1r/P5 harness library (throwaway, never product code): builds a controller + driver package around an
// operation with states and prints the controller's observable behaviour.
import { pathToFileURL } from 'node:url';
const outDir = process.env.P4_OUT ?? 'E:/t/sw-p4/out';
const base = pathToFileURL(outDir + '/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
export const { simulate, runCase } = await import(base + 'src/simulation/simulator.js');

export async function parse(text, warnings = false) {
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(text, { documentUri: `file:///m-${Math.random().toString(36).slice(2)}.swaml`, validation: true });
  const diags = (d.diagnostics ?? []).filter(x => x.severity === 1 || warnings && x.severity === 2);
  return { doc: d, model: d.parseResult.value, errors: diags.filter(x => x.severity === 1), diags, parserErrors: d.parseResult.parserErrors, lexerErrors: d.parseResult.lexerErrors };
}
/** ports: { name: [member declarations from the controller's side] }; the driver gets reversed ports and sinks for outputs. */
export function model({ pkg, types = '', ports, attributes = '', ops = '', control, entry }, script) {
  const defs = Object.entries(ports).map(([p, ms]) => `  port def P_${p} { ${ms.map(m => m + ';').join(' ')} }`).join('\n');
  const cports = Object.keys(ports).map(p => `port ${p}: P_${p};`).join(' ');
  const dports = Object.keys(ports).map(p => `reversed port ${p}: P_${p};`).join(' ');
  const sinks = Object.entries(ports).flatMap(([p, ms]) => ms.filter(m => m.startsWith('provides')).map(m => {
    const name = /(?:event|attribute) ('[^']+'|\w+)/.exec(m)[1], params = /\(([^)]*)\)/.exec(m)?.[1] ?? '';
    const n = /attribute/.test(m) ? 1 : params.split(',').filter(x => x.trim()).length;
    return `on receive ${p}.${name}(${Array.from({ length: n }, (_, i) => 'b' + i).join(', ')}) sink();`;
  }));
  const zero = t => t.trim() === 'bool' ? 'false' : '0';
  const emits = Object.entries(ports).flatMap(([p, ms]) => ms.filter(m => m.startsWith('requires event')).map(m => {
    const name = /event ('[^']+'|\w+)/.exec(m)[1], params = (/\(([^)]*)\)/.exec(m)?.[1] ?? '').split(',').filter(x => x.trim());
    return `publish ${p}.${name}(${params.map(x => zero(x.split(':')[1])).join(', ')});`;
  }));
  const connects = Object.keys(ports).map(p => `  connect (c.${p}, d.${p});`).join('\n');
  return `package ${pkg} {
${types}
${defs}
  component def Controller {
    ${cports}
    ${attributes}
    ${ops}
    operation ${control}
    schedule { on start ${entry}(); }
  }
  component def Driver {
    ${dports}
    operation sink() { }
    operation emitAll() { ${emits.join(' ')} }
    operation script() { ${script} }
    schedule { on start script(); ${sinks.join(' ')} }
  }
  component c: Controller;
  component d: Driver;
${connects}
}`;
}
export const fmt = ns => ns >= 1e9 && ns % 1e6 === 0 ? `${ns / 1e9}s` : `${ns / 1e6}ms`;
/** Runs one driver script against sample s; returns printable lines and the result. */
export async function run(s, name, script, untilNs, extra = {}) {
  const text = model(s, script);
  const p = await parse(text);
  if (p.errors.length) { console.log(`  ${name}: INVALID\n` + p.errors.map(e => `    ${e.range.start.line + 1}: ${e.message}`).join('\n') + '\n' + text.split('\n').map((l, i) => `${i + 1} ${l}`).join('\n')); return; }
  const r = simulate([p.model], s.pkg, { untilNs, maxSteps: 2000000, ...extra });
  const lines = traceLines(r, s);
  console.log(`  ${name} [${r.status}, ${fmt(r.timeNs)}]: stores ${JSON.stringify(r.stores['c'])}`);
  for (const l of lines) console.log('      ' + l);
  return r;
}
export function traceLines(r, s = {}) {
  const lines = [];
  for (const e of r.trace) {
    const at = fmt(e.timeNs), subj = String(e.subject);
    if (e.kind === 'state' && subj.startsWith('c.')) lines.push(`${at} ${e.stay ? 'stay' : 'state'} ${e.state}${e.trigger ? ' (via ' + e.trigger.replace(/^.*?\.\w+\//, '') + ')' : ''}`);
    else if ((e.kind === 'publish' || e.kind === 'send') && subj.startsWith('c.')) lines.push(`${at} ${e.kind} ${subj.slice(2)}(${(e.args ?? []).map(x => JSON.stringify(x)).join(', ')})`);
    else if (e.kind === 'publish' && subj.startsWith('d.')) lines.push(`${at} >> ${subj.slice(2)}(${(e.args ?? []).map(x => JSON.stringify(x)).join(', ')})`);
    else if (e.kind === 'discardInput' && (subj.startsWith('c.') || !subj.includes('.') || /^\w+\.\w+$/.test(subj))) lines.push(`${at} discard ${subj} (${e.reason})`);
    else if (e.kind === 'complete' && s.entry && subj === `c.${s.entry}`) lines.push(`${at} ${s.entry} completes`);
    else if (e.kind === 'write' && subj.startsWith('c.') && s.watch?.includes(subj.slice(2))) lines.push(`${at} ${subj.slice(2)} = ${JSON.stringify(e.value)}`);
    else if (e.kind === 'failure' || e.kind === 'violation') lines.push(`${at} ${e.kind} ${subj} ${e.reason ?? e.code}`);
  }
  return lines;
}
