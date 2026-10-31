import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { simulate } from '../out/src/simulation/simulator.js';
const runs = JSON.parse(await readFile(new URL('../examples/simulation/runs.json', import.meta.url), 'utf8'));
for (const run of runs) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const text = await readFile(new URL(`../${run.model}`, import.meta.url), 'utf8');
    const document = await parseHelper(Swaml)(text, { documentUri: `file:///${run.model}`, validation: true });
    assert.deepEqual(document.diagnostics?.filter(d => d.severity === 1) ?? [], []);
    const options = JSON.parse(await readFile(new URL(`../${run.options}`, import.meta.url), 'utf8'));
    const result = simulate([document.parseResult.value], run.target, options);
    assert.equal(result.outcome, 'no-failure-observed', JSON.stringify(result.trace.filter(t => t.kind === 'failure' || t.kind === 'violation')));
    for (const [component, store] of Object.entries(run.expectedStores)) for (const [name, value] of Object.entries(store)) assert.deepEqual(result.stores[component][name], value, `${run.target}: ${component}.${name}`);
    for (const [path, node] of Object.entries(run.expectedDeployments ?? {})) assert.equal(result.deployments[path], node, `${run.target}: deployment of ${path}`);
    const repeated = simulate([document.parseResult.value], run.target, options);
    assert.deepEqual(result, repeated, 'Reproducibility');
    if (run.target === 'Hello::Demo') {
        const path = new URL('../examples/simulation/hello-trace.json', import.meta.url);
        if (process.argv.includes('--write')) await writeFile(path, JSON.stringify(result, null, 2) + '\n');
        else assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), JSON.parse(JSON.stringify(result)), 'Published trace is stale; regenerate deliberately with --write');
    }
    console.log(`Simulated ${result.target.kind} ${run.target}: ${result.status}, ${result.trace.length} observations, expected stores match.`);
}
