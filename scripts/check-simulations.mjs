import { readFile, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { runCase, runTests, simulate } from '../out/src/simulation/simulator.js';
const root = new URL('../', import.meta.url);
async function load(model) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const text = await readFile(new URL(model, root), 'utf8');
    const document = await parseHelper(Swaml)(text, { documentUri: `file:///${model}`, validation: true });
    assert.deepEqual(document.diagnostics?.filter(d => d.severity === 1) ?? [], [], model);
    return [document.parseResult.value];
}
// Reference runs: a run target, or one executable case, with expected final stores and placements.
const runs = JSON.parse(await readFile(new URL('examples/simulation/runs.json', root), 'utf8'));
for (const run of runs) {
    const models = await load(run.model);
    const options = JSON.parse(await readFile(new URL(run.options, root), 'utf8'));
    const execute = () => run.case ? runCase(models, run.case, options) : simulate(models, run.target, options);
    const outcome = execute(), result = run.case ? outcome.run : outcome, name = run.case ?? run.target;
    if (run.case)
        assert.equal(outcome.result, run.expectedResult, `${name}: ${outcome.message}`);
    else
        assert.equal(result.outcome, 'no-failure-observed', JSON.stringify(result.trace.filter(t => t.kind === 'failure' || t.kind === 'violation')));
    for (const [component, store] of Object.entries(run.expectedStores)) for (const [key, value] of Object.entries(store)) assert.deepEqual(result.stores[component][key], value, `${name}: ${component}.${key}`);
    for (const [path, node] of Object.entries(run.expectedDeployments ?? {})) assert.equal(result.deployments[path], node, `${name}: deployment of ${path}`);
    assert.deepEqual(outcome, execute(), 'Reproducibility');
    if (run.target === 'Hello::Demo') {
        const path = new URL('examples/simulation/hello-trace.json', root);
        if (process.argv.includes('--write')) await writeFile(path, JSON.stringify(result, null, 2) + '\n');
        else assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), JSON.parse(JSON.stringify(result)), 'Published trace is stale; regenerate deliberately with --write');
    }
    console.log(`Simulated ${run.case ? 'case' : result.target.kind} ${name}: ${result.status}, ${result.trace.length} observations, expected stores match.`);
}
// Every use case and test of every complete example runs with its expected result.
const expected = JSON.parse(await readFile(new URL('examples/simulation/cases.json', root), 'utf8'));
async function walk(path) { const files = []; for (const e of await readdir(new URL(path, root), { withFileTypes: true })) { if (e.name === 'invalid') continue; if (e.isDirectory()) files.push(...await walk(path + e.name + '/')); else if (e.name.endsWith('.swaml')) files.push(path + e.name); } return files; }
let total = 0;
for (const model of (await walk('examples/')).sort()) {
    const models = await load(model), results = runTests(models, expected.options);
    if (!results.length) continue;
    assert.deepEqual(Object.fromEntries(results.map(r => [r.case, r.result])), expected.examples[model] ?? {}, `${model}: case results (${results.filter(r => r.message).map(r => r.case + ': ' + r.message).join('; ')})`);
    assert.deepEqual(results, runTests(models, expected.options), `${model}: case reproducibility`);
    total += results.length;
}
assert.equal(total, Object.values(expected.examples).reduce((n, cases) => n + Object.keys(cases).length, 0), 'Every listed example case was run');
console.log(`Ran ${total} example use cases and tests with their expected results.`);
