// States in the flow: a controller and driver package built around one operation with states, and a printable reading of
// the controller's observable behaviour. Ported from the interpreter prototype's harness (prototype/states-in-flow-r5,
// p4/lib.mjs), so that the reading samples of docs/proposals/STATES_IN_FLOW_READING_SAMPLES.md run as cases here and
// their output can be compared with the prototype's recorded evidence line by line.
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import type { Model } from '../../src/language/generated/ast.js';
import { simulate, type SimulationOptions, type SimulationResult } from '../../src/simulation/simulator.js';

export type Sample = {
    pkg: string;
    types?: string;
    /** Port name to the member declarations seen from the controller. */
    ports: Record<string, string[]>;
    attributes?: string;
    ops?: string;
    /** The controller's operation, from its name to its closing brace. */
    control: string;
    entry: string;
    /** Attributes whose writes are printed. */
    watch?: string[];
};
export type Question = [name: string, script: string, untilNs: number];

/** The controller c with the operation, and a driver d with reversed ports that runs script on start and sinks every output. */
export function sampleModel({ pkg, types = '', ports, attributes = '', ops = '', control, entry }: Sample, script: string): string {
    const defs = Object.entries(ports).map(([p, ms]) => `  port def P_${p} { ${ms.map(m => m + ';').join(' ')} }`).join('\n');
    const cports = Object.keys(ports).map(p => `port ${p}: P_${p};`).join(' ');
    const dports = Object.keys(ports).map(p => `reversed port ${p}: P_${p};`).join(' ');
    const sinks = Object.entries(ports).flatMap(([p, ms]) => ms.filter(m => m.startsWith('provides')).map(m => {
        const name = /(?:event|attribute) ('[^']+'|\w+)/.exec(m)![1], params = /\(([^)]*)\)/.exec(m)?.[1] ?? '';
        const n = /attribute/.test(m) ? 1 : params.split(',').filter(x => x.trim()).length;
        return `on receive ${p}.${name}(${Array.from({ length: n }, (_, i) => 'b' + i).join(', ')}) sink();`;
    }));
    // Every event the driver could send has an emitting operation, so that each script validates.
    const zero = (t: string) => t.trim() === 'bool' ? 'false' : '0';
    const emits = Object.entries(ports).flatMap(([p, ms]) => ms.filter(m => m.startsWith('requires event')).map(m => {
        const name = /event ('[^']+'|\w+)/.exec(m)![1], params = (/\(([^)]*)\)/.exec(m)?.[1] ?? '').split(',').filter(x => x.trim());
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
export async function parseSample(text: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(text, { validation: true });
    const errors = (doc.diagnostics ?? []).filter(x => x.severity === 1);
    return { doc, model: doc.parseResult.value, errors };
}
const fmt = (ns: number) => ns >= 1e9 && ns % 1e6 === 0 ? `${ns / 1e9}s` : `${ns / 1e6}ms`;
/** The controller's observable behaviour, one line per observation, as the prototype printed it. */
export function traceLines(r: SimulationResult, s: Partial<Sample> = {}): string[] {
    const lines: string[] = [];
    for (const e of r.trace as Record<string, unknown>[]) {
        const at = fmt(e.timeNs as number), subj = String(e.subject), args = () => ((e.args as unknown[]) ?? []).map(x => JSON.stringify(x)).join(', ');
        if (e.kind === 'state' && subj.startsWith('c.'))
            lines.push(`${at} ${e.stay ? 'stay' : 'state'} ${e.state}${e.trigger ? ' (via ' + String(e.trigger).replace(/^.*?\.\w+\//, '') + ')' : ''}`);
        else if ((e.kind === 'publish' || e.kind === 'send') && subj.startsWith('c.'))
            lines.push(`${at} ${e.kind} ${subj.slice(2)}(${args()})`);
        else if (e.kind === 'publish' && subj.startsWith('d.'))
            lines.push(`${at} >> ${subj.slice(2)}(${args()})`);
        else if (e.kind === 'discardInput' && (subj.startsWith('c.') || !subj.includes('.') || /^\w+\.\w+$/.test(subj)))
            lines.push(`${at} discard ${subj} (${e.reason})`);
        else if (e.kind === 'complete' && s.entry && subj === `c.${s.entry}`)
            lines.push(`${at} ${s.entry} completes`);
        else if (e.kind === 'write' && subj.startsWith('c.') && s.watch?.includes(subj.slice(2)))
            lines.push(`${at} ${subj.slice(2)} = ${JSON.stringify(e.value)}`);
        else if (e.kind === 'failure' || e.kind === 'violation')
            lines.push(`${at} ${e.kind} ${subj} ${String(e.reason ?? e.code)}`);
    }
    return lines;
}
/** Runs one driver script against sample s; the printed block (header and lines) and the result. */
export async function runSample(s: Sample, name: string, script: string, untilNs: number, options: Partial<SimulationOptions> = {}): Promise<{ text: string; result?: SimulationResult }> {
    const p = await parseSample(sampleModel(s, script));
    if (p.errors.length)
        return { text: `  ${name}: INVALID\n` + p.errors.map(e => `    ${e.range.start.line + 1}: ${e.message}`).join('\n') };
    const r = simulate([p.model], s.pkg, { untilNs, maxSteps: 2000000, ...options });
    return { text: [`  ${name} [${r.status}, ${fmt(r.timeNs)}]: stores ${JSON.stringify(r.stores['c'])}`, ...traceLines(r, s).map(l => '      ' + l)].join('\n'), result: r };
}
