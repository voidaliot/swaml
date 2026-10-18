import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { EmptyFileSystem, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { members, nanos } from '../out/src/language/semantic.js';
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
const architecture = document.parseResult.value.packages[0].elements.find(a.isRootComponent);
const contracts = [], declarations = [];
function visit(component, prefix = '') {
    for (const member of members(component)) {
        const path = prefix ? `${prefix}.${member.name}` : member.name;
        if (a.isInstance(member)) visit(member.definition.ref, path);
        if (!a.isFunctionDef(member)) continue;
        const definition = owner(member, a.isComponent) ?? owner(member, a.isRootComponent);
        const definitionPath = `${owner(definition, a.isPackage).name}::${definition.name}.${member.name}`;
        contracts.push({ functionPath: path, definitionPath, concurrency: member.timing?.concurrency ?? 'serial',
            ...(member.timing ? { wcetNs: nanos(member.timing.wcet), deadlineNs: nanos(member.timing.deadline) } : {}) });
        declarations.push({ functionPath: path, definitionPath, source: member.$cstNode.text });
    }
}
visit(architecture);
const runs = [
    { id: 'success', title: 'Reply before timeout', description: 'Two client occurrences run independently. A second release of first.poll waits for its serial lock.', options: baseline },
    { id: 'timeout', title: 'Timeout and late reply', description: 'The request expires at 20 ms. Later replies are discarded and cannot resume the caller.', options: { ...baseline, untilNs: 60000000, latencyNs: 12000000, manual: baseline.manual.slice(0, 2) } },
    { id: 'horizon', title: 'Open at the horizon', description: 'The observation ends at 3 ms while callers await responses and one release awaits dispatch.', options: { ...baseline, untilNs: 3000000 } },
    { id: 'deadline', title: 'Declared deadline missed', description: 'The queued second activation cannot finish by its 31 ms deadline. The run stops with the pending intervals still open.', options: { ...baseline, latencyNs: 18000000 } }
].map(run => {
    const evidence = simulate([document.parseResult.value], 'FunctionTiming::Demo', run.options);
    return { ...run, trace: evidence.trace, timing: projectFunctionTiming(evidence, contracts) };
});
assert.ok(runs[0].timing.activations.some(a => a.intervals.some(i => i.state === 'ready' && i.end.timeNs > i.start.timeNs)));
assert.ok(runs[1].trace.some(e => e.kind === 'discardResponse'));
assert.ok(runs[2].timing.activations.some(a => a.intervals.some(i => i.open)));
assert.ok(runs[3].timing.stops.some(e => e.code === 'Deadline'));
const result = { version: 1, model, root: 'FunctionTiming::Demo', sourceSha256: createHash('sha256').update(source).digest('hex'), contracts, declarations, runs };
const text = JSON.stringify(result, null, 2) + '\n', output = new URL('spec/function-timing-demo.json', root);
if (process.argv.includes('--check')) assert.equal(await readFile(output, 'utf8'), text, 'Function timing demo is stale; run node scripts/build-timing-demo.mjs');
else await writeFile(output, text);
console.log(`Function timing demo: ${runs.length} reproducible simulations, ${contracts.length} occurrence contracts and ${runs.reduce((n, r) => n + r.timing.activations.length, 0)} activation lanes.`);
