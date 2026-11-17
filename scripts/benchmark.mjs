// Reference implementation benchmark: model projection and simulation throughput as the model and the
// run grow. Run after npm run build: npm run bench [-- --scales 1,4,16 --runs 1,4,16 --json]
// The models are deterministic (scripts/bench/large-model.mjs); timings depend on the machine, so this
// is evidence for scaling, not a pass/fail gate.
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { largeModel, periodicModel, timerModel } from './bench/large-model.mjs';

// --build <dir> measures another built out/ directory, such as a build of the revision before a change.
const build = process.argv.includes('--build') ? path.resolve(process.argv[process.argv.indexOf('--build') + 1]) : fileURLToPath(new URL('../out/', import.meta.url));
const at = file => import(pathToFileURL(path.join(build, file)).href);
const { createSwamlServices } = await at('src/language/swaml-module.js'), { projectModel } = await at('src/language/projection.js'), { simulate } = await at('src/simulation/simulator.js');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1].split(',').map(Number); };
const scales = arg('scales', [1, 4, 16]), runs = arg('runs', [1, 4, 16, 64]), json = process.argv.includes('--json');

async function load(text) {
    const { Swaml } = createSwamlServices(EmptyFileSystem), document = await parseHelper(Swaml)(text, { validation: true });
    const errors = document.diagnostics?.filter(d => d.severity === 1) ?? [];
    if (errors.length)
        throw new Error(`Benchmark model is invalid: ${errors[0].message}`);
    return document.parseResult.value;
}
const median = values => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];
function time(work, repeat) {
    const samples = [];
    let result;
    for (let i = 0; i < repeat; i++) {
        const start = performance.now();
        result = work();
        samples.push(performance.now() - start);
    }
    return { ms: median(samples), result };
}
const report = { node: process.version, projection: [], simulation: [], timers: [] };
for (const scale of scales) {
    const text = largeModel(scale), model = await load(text);
    const { ms, result } = time(() => projectModel([model]), scale >= 16 ? 1 : scale >= 4 ? 3 : 5);
    report.projection.push({ scale, lines: text.split('\n').length - 1, nodes: result.nodes.length, edges: result.edges.length, ms: Number(ms.toFixed(1)) });
}
// One run unit is 25 ms of the periodic model, about 4,000 steps.
const periodic = await load(periodicModel({ producers: 4, periodMs: 1 }));
for (const factor of runs) {
    const { ms, result } = time(() => simulate([periodic], 'Load', { untilNs: 25_000_000 * factor, maxSteps: 100_000_000, maxPending: 1_000_000 }), factor >= 16 ? 1 : 3);
    report.simulation.push({ factor, untilNs: result.options.untilNs, steps: result.steps, trace: result.trace.length, ms: Number(ms.toFixed(1)), stepsPerSecond: Math.round(result.steps / (ms / 1000)) });
}
// Long receive timeouts that are almost always cancelled: pending events stay bounded as the run grows.
const timers = await load(timerModel({ iterations: 1_000_000 }));
for (const factor of runs) {
    const { ms, result } = time(() => simulate([timers], 'Timers', { untilNs: 1_000_000_000 * factor, maxSteps: 100_000_000 }), factor >= 16 ? 1 : 3);
    report.timers.push({ factor, untilNs: result.options.untilNs, steps: result.steps, trace: result.trace.length, ms: Number(ms.toFixed(1)), stepsPerSecond: Math.round(result.steps / (ms / 1000)) });
}
if (json)
    console.log(JSON.stringify(report, null, 2));
else {
    console.log(`Node ${report.node}`);
    console.log('projectModel (median)');
    console.table(report.projection);
    console.log('simulate Load (median)');
    console.table(report.simulation);
    console.log('simulate Timers (median)');
    console.table(report.timers);
}
