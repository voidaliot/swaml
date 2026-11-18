import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { runCase, runTests, simulate } from '../out/src/simulation/simulator.js';
import { readStandardVersion } from './standard-version.mjs';
import { caseOptions, checkCasesFile, checkModelOptionsUsed } from './simulation-cases.mjs';
const root = new URL('../', import.meta.url);
const edition = await readStandardVersion();
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
    // The verdict message where a case is expected to fail, such as the violation that fails it.
    if (run.expectedMessage !== undefined)
        assert.equal(outcome.message, run.expectedMessage, `${name}: verdict message`);
    for (const [component, store] of Object.entries(run.expectedStores)) for (const [key, value] of Object.entries(store)) assert.deepEqual(result.stores[component][key], value, `${name}: ${component}.${key}`);
    for (const [path, node] of Object.entries(run.expectedDeployments ?? {})) assert.equal(result.deployments[path], node, `${name}: deployment of ${path}`);
    // The reasons of caught failures, in trace order, where a run names them (a try cannot tell its reason to the model).
    if (run.expectedCaught)
        assert.deepEqual(result.trace.filter(t => t.kind === 'caught').map(t => t.reason), run.expectedCaught, `${name}: caught failure reasons`);
    assert.deepEqual(outcome, execute(), 'Reproducibility');
    if (run.target === 'Hello::Demo') {
        const directory = new URL(`examples/simulation/${edition}/`, root), path = new URL('hello-trace.json', directory);
        if (process.argv.includes('--write')) {
            await mkdir(directory, { recursive: true });
            await writeFile(path, JSON.stringify(result, null, 2) + '\n');
        } else assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), JSON.parse(JSON.stringify(result)), 'Current edition trace is stale; regenerate deliberately with --write');
    }
    console.log(`Simulated ${run.case ? 'case' : result.target.kind} ${name}: ${result.status}, ${result.trace.length} observations, expected stores match.`);
}
// Every use case and test of every complete example runs with its expected result, using the example's
// own options from modelOptions over the global options.
async function walk(path) { const files = []; for (const e of await readdir(new URL(path, root), { withFileTypes: true })) { if (e.name === 'invalid') continue; if (e.isDirectory()) files.push(...await walk(path + e.name + '/')); else if (e.name.endsWith('.swaml')) files.push(path + e.name); } return files; }
const examples = (await walk('examples/')).sort();
const expected = checkCasesFile(JSON.parse(await readFile(new URL('examples/simulation/cases.json', root), 'utf8')), examples);
let total = 0;
for (const model of examples) {
    const options = caseOptions(expected, model), models = await load(model), results = runTests(models, options);
    checkModelOptionsUsed(expected, model, results.length);
    if (!results.length) continue;
    assert.deepEqual(Object.fromEntries(results.map(r => [r.case, r.result])), expected.examples[model] ?? {}, `${model}: case results (${results.filter(r => r.message).map(r => r.case + ': ' + r.message).join('; ')})`);
    assert.deepEqual(results, runTests(models, options), `${model}: case reproducibility`);
    total += results.length;
}
assert.equal(total, Object.values(expected.examples).reduce((n, cases) => n + Object.keys(cases).length, 0), 'Every listed example case was run');
console.log(`Ran ${total} example use cases and tests with their expected results.`);
