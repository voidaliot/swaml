import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { EmptyFileSystem, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, selectView } from '../out/src/language/swaml-module.js';
import { nanos } from '../out/src/language/semantic.js';
import { owner } from '../out/src/language/swaml-scope.js';
import * as a from '../out/src/language/generated/ast.js';
import { simulate } from '../out/src/simulation/simulator.js';
import { projectFunctionTiming } from '../out/src/simulation/timing.js';

const root = new URL('../', import.meta.url), model = 'examples/17-function-timing.swaml';
const source = await readFile(new URL(model, root), 'utf8');
const baseline = JSON.parse(await readFile(new URL('examples/simulation/17-function-timing.json', root), 'utf8'));
const { Swaml } = createSwamlServices(EmptyFileSystem);
const document = await parseHelper(Swaml)(source, { validation: true, documentUri: URI.parse(`file:///${model}`) });
assert.deepEqual(document.diagnostics, [], model);
const contracts = [], declarations = [];
const timingView = document.parseResult.value.packages[0].elements.find(element => a.isView(element) && element.name === 'functionTiming');
assert.ok(timingView && timingView.kind === 'tv', 'Function timing uses the dedicated tv source view.');
const timingSelection = selectView(timingView);
assert.ok(timingSelection.every(selection => a.isFunctionDef(selection.node)), 'Timing subjects must be executable functions.');
for (const selection of timingSelection) {
    const member = selection.node;
    assert.ok(selection.path.startsWith('Demo.'), 'Timing occurrences belong to the selected execution root.');
    const path = selection.path.slice('Demo.'.length);
    const definition = owner(member, a.isComponent) ?? owner(member, a.isRootComponent);
    const definitionPath = `${owner(definition, a.isPackage).name}::${definition.name}.${member.name}`;
    contracts.push({ functionPath: path, definitionPath, concurrency: member.timing?.concurrency ?? 'serial',
        ...(member.timing ? { wcetNs: nanos(member.timing.wcet), deadlineNs: nanos(member.timing.deadline) } : {}) });
    declarations.push({ functionPath: path, definitionPath, source: member.$cstNode.text });
}
assert.deepEqual(timingSelection.map(selection => selection.path), contracts.map(contract => `Demo.${contract.functionPath}`), 'Timing source selection and occurrence contracts must match in order.');
assert.deepEqual(timingSelection.map(selection => selection.path), ['Demo.first.poll', 'Demo.second.poll', 'Demo.firstServer.checkHealth', 'Demo.secondServer.checkHealth']);
const runs = [
    { id: 'success', title: 'Reply before timeout', description: 'Two client occurrences run independently. A second release of first.poll waits for its serial lock.', options: baseline },
    { id: 'timeout', title: 'Timeout and late reply', description: 'The first request times out at 32 ms and its late reply is discarded at 36 ms. The queued activation remains open at the 40 ms observation boundary, before its 43 ms deadline.', options: { ...baseline, untilNs: 40000000, latencyNs: 12000000 } },
    { id: 'horizon', title: 'Open at the horizon', description: 'The observation ends while callers await responses and one routed input awaits serial dispatch.', options: { ...baseline, untilNs: 5000000 } },
    { id: 'deadline', title: 'Declared deadline missed', description: 'The queued second activation misses its deadline. The run stops with pending intervals still open.', options: { ...baseline, untilNs: 80000000, latencyNs: 18000000 } }
].map(run => {
    const evidence = simulate([document.parseResult.value], 'FunctionTiming::Demo', run.options);
    const projection = projectFunctionTiming(evidence, contracts);
    const selectedPaths = new Set(contracts.map(contract => contract.functionPath));
    const timing = { ...projection, activations: projection.activations.filter(activation => selectedPaths.has(activation.functionPath)) };
    return { ...run, trace: evidence.trace, timing };
});
assert.ok(runs[0].timing.activations.some(a => a.intervals.some(i => i.state === 'ready' && i.end.timeNs > i.start.timeNs)));
assert.ok(runs[1].trace.some(e => e.kind === 'discardResponse'));
assert.ok(runs[1].timing.activations.some(a => a.functionPath === 'first.poll' && a.outcome === 'open' && a.deadlineAtNs === 43000000));
assert.equal(runs[1].timing.endNs, 40000000);
assert.deepEqual(runs[1].timing.stops, []);
assert.ok(runs[2].timing.activations.some(a => a.intervals.some(i => i.open)));
assert.ok(runs[3].timing.stops.some(e => e.code === 'Deadline'));
const result = { version: 1, model, root: 'FunctionTiming::Demo', sourceSha256: createHash('sha256').update(source).digest('hex'), contracts, declarations, runs };
const text = JSON.stringify(result, null, 2) + '\n', output = new URL('spec/function-timing-demo.json', root);
if (process.argv.includes('--check')) assert.equal(await readFile(output, 'utf8'), text, 'Function timing demo is stale; run node scripts/build-timing-demo.mjs');
else await writeFile(output, text);
console.log(`Function timing demo: ${runs.length} reproducible simulations, ${contracts.length} occurrence contracts and ${runs.reduce((n, r) => n + r.timing.activations.length, 0)} activation lanes.`);
