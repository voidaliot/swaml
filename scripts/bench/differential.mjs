// Differential check of projectModel, simulate and runTests between this build (out/) and a
// reference build of another revision, for example the revision before a performance change:
//   git worktree add ../swaml-ref <revision> && (cd ../swaml-ref && npm ci && npm run build)
//   node scripts/bench/differential.mjs --reference ../swaml-ref/out [--seeds 300] [--corpus calls.jsonl]
// Each source is parsed and validated separately by each build. Every result, or thrown message, must
// be deep-strictly equal: traces with their ordinals, timestamps and order of simultaneous events,
// final stores, statuses, failures and projection nodes and edges. Models: every example (with its
// reference options and adverse options for limits, faults and latency), the large benchmark models,
// seeded random models, and optionally a corpus of recorded calls (JSON lines of
// { fn, sources: [{ uri, text }], args }). Invalid sources (examples/invalid and every example with its
// package name removed or truncated) compare projectModel only, since a run requires a valid model.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { URI } from 'langium';
import { largeModel, periodicModel, timerModel } from './large-model.mjs';
import { randomModel, randomOptions } from './random-model.mjs';

const value = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const reference = value('reference');
if (!reference)
    throw new Error('Usage: node scripts/bench/differential.mjs --reference <built out directory> [--seeds N] [--corpus file]');
const root = new URL('../../', import.meta.url);
async function build(dir) {
    const at = file => import(pathToFileURL(path.resolve(dir, file)).href);
    const [module, simulator, projection, semantic] = await Promise.all(['src/language/swaml-module.js', 'src/simulation/simulator.js', 'src/language/projection.js', 'src/language/semantic.js'].map(at));
    return { createSwamlServices: module.createSwamlServices, ...simulator, ...projection, runTargets: semantic.runTargets };
}
const current = await build(fileURLToPath(new URL('out/', root))), old = await build(reference);
async function load(impl, sources) {
    const s = impl.createSwamlServices((await import('langium')).EmptyFileSystem);
    const docs = sources.map(x => s.shared.workspace.LangiumDocumentFactory.fromString(x.text, URI.parse(x.uri)));
    docs.forEach(d => s.shared.workspace.LangiumDocuments.addDocument(d));
    await s.shared.workspace.DocumentBuilder.build(docs, { validation: true });
    return { models: docs.map(d => d.parseResult.value), errors: docs.flatMap(d => d.diagnostics ?? []).filter(d => d.severity === 1).length };
}
/** The path of the first difference between two results, for the failure message. */
function difference(x, y, at = '$') {
    if (Object.is(x, y))
        return undefined;
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null || Array.isArray(x) !== Array.isArray(y))
        return `${at}: ${JSON.stringify(x)?.slice(0, 200)} != ${JSON.stringify(y)?.slice(0, 200)}`;
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    for (const k of keys) {
        if (!(k in x) || !(k in y))
            return `${at}.${k}: present in ${k in x ? 'this build' : 'reference'} only`;
        const d = difference(x[k], y[k], `${at}.${k}`);
        if (d)
            return d;
    }
    return undefined;
}
const attempt = work => { try { return { value: work() }; } catch (e) { return { error: String(e?.message ?? e) }; } };
const coverage = {};
const stats = { models: 0, invalid: 0, comparisons: 0, simulations: 0, traceEvents: 0, sameTimeObservations: 0 };
/** Consecutive observations at the same time in a trace (not a count of distinct simultaneous events). */
const sameTime = run => { let n = 0; for (let i = 1; i < (run?.trace?.length ?? 0); i++) if (run.trace[i].timeNs === run.trace[i - 1].timeNs) n++; return n; };
function count(result) {
    const runs = Array.isArray(result) ? result.map(x => x.run) : [result?.run ?? result];
    for (const run of runs)
        if (run?.trace) {
            stats.simulations++;
            stats.traceEvents += run.trace.length;
            stats.sameTimeObservations += sameTime(run);
            coverage[run.status] = (coverage[run.status] ?? 0) + 1;
            for (const t of run.trace)
                if (t.kind !== 'write' && t.kind !== 'release' && t.kind !== 'dispatch')
                    coverage[t.kind === 'violation' ? `violation ${t.code}` : t.kind] = (coverage[t.kind === 'violation' ? `violation ${t.code}` : t.kind] ?? 0) + 1;
        }
}
async function compare(name, sources, calls) {
    const [a, b] = [await load(current, sources), await load(old, sources)];
    assert.equal(a.errors, b.errors, `${name}: validation`);
    stats.models++;
    if (a.errors) {
        stats.invalid++;
        const mine = attempt(() => current.projectModel(a.models)), theirs = attempt(() => old.projectModel(b.models));
        assert.deepStrictEqual(mine, theirs, `${name}: projectModel of an invalid model: first difference at ${difference(mine, theirs)}`);
        stats.comparisons++;
        return;
    }
    for (const call of calls(a.models)) {
        const mine = attempt(() => call(current, a.models)), theirs = attempt(() => call(old, b.models));
        assert.deepStrictEqual(mine, theirs, `${name}: ${call.label}: first difference at ${difference(mine, theirs)}`);
        stats.comparisons++;
        count(mine.value);
    }
}
const labelled = (label, fn) => Object.assign(fn, { label });
const variants = base => [base, { ...base, latencyNs: 1_000_000 }, { ...base, faults: [{ offer: 1, kind: 'drop' }, { offer: 2, kind: 'duplicate', delayNs: 2_000_000 }, { offer: 4, kind: 'transport' }] }, { ...base, maxPending: 1, maxConcurrent: 1 }, { ...base, maxSteps: 37 }, { ...base, maxSteps: 400 }];
function standard(options) {
    return models => [
        labelled('projectModel', (impl, own) => impl.projectModel(own)),
        ...current.runTargets(models).flatMap(t => options.map((o, i) => labelled(`simulate ${t.identity} #${i}`, (impl, own) => impl.simulate(own, t.identity, o)))),
        ...options.map((o, i) => labelled(`runTests #${i}`, (impl, own) => impl.runTests(own, o)))
    ];
}
const text = async file => (await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n');
async function walk(dir) {
    const files = [];
    for (const e of await readdir(new URL(dir, root), { withFileTypes: true }))
        if (e.isDirectory() && e.name !== 'invalid')
            files.push(...await walk(`${dir}${e.name}/`));
        else if (e.name.endsWith('.swaml'))
            files.push(`${dir}${e.name}`);
    return files.sort();
}
const runs = JSON.parse(await text('examples/simulation/runs.json'));
for (const file of await walk('examples/')) {
    const own = await Promise.all(runs.filter(r => r.model === file).map(async r => JSON.parse(await text(r.options))));
    const options = [...own, ...variants({ untilNs: 1_000_000_000 }), { untilNs: 10_000_000_000 }];
    await compare(file, [{ uri: `file:///${file}`, text: await text(file) }], standard(options));
}
for (const file of (await readdir(new URL('examples/invalid/', root))).filter(f => f.endsWith('.swaml')).sort())
    await compare(file, [{ uri: `file:///examples/invalid/${file}`, text: await text(`examples/invalid/${file}`) }], standard([]));
for (const file of await walk('examples/')) {
    const source = await text(file), nameless = source.replace(/^package [^{]*\{/m, 'package {');
    for (const [i, variant] of [nameless, ...[0.2, 0.4, 0.6, 0.8].flatMap(f => [source, nameless].map(t => t.slice(0, Math.floor(t.length * f))))].entries())
        await compare(`${file} edit ${i}`, [{ uri: `file:///${file}`, text: variant }, ...(i % 2 ? [] : [{ uri: 'file:///other.swaml', text: 'package undefined { component def B { attribute x: int = 0; } }' }])], standard([{ untilNs: 100_000_000 }]));
}
console.log(`examples: ${JSON.stringify(stats)}`);
for (const scale of [1, 2])
    await compare(`large ${scale}`, [{ uri: `file:///large-${scale}.swaml`, text: largeModel(scale) }], standard([{ untilNs: 50_000_000 }, { untilNs: 10_000_000_000, maxSteps: 30_000 }]));
for (const producers of [1, 3, 6])
    await compare(`periodic ${producers}`, [{ uri: `file:///periodic-${producers}.swaml`, text: periodicModel({ producers }) }], standard([{ untilNs: 40_000_000, maxSteps: 1_000_000 }, ...variants({ untilNs: 15_000_000 })]));
for (const [iterations, timeout] of [[3000, '10s'], [3000, '1s'], [3000, '2ms'], [500, '1ms']])
    await compare(`timers ${iterations} ${timeout}`, [{ uri: `file:///timers.swaml`, text: timerModel({ iterations, timeout }) }], standard([{ untilNs: 4_000_000_000, maxSteps: 1_000_000 }, { untilNs: 700_000_000, latencyNs: 1_000_000 }, { untilNs: 1_000_000_000, maxSteps: 5_000 }]));
console.log(`generated: ${JSON.stringify(stats)}`);
const seeds = Number(value('seeds') ?? 200);
for (let seed = 1; seed <= seeds; seed++)
    await compare(`random seed ${seed}`, [{ uri: `file:///random-${seed}.swaml`, text: randomModel(seed) }], standard([randomOptions(seed), randomOptions(seed + 7919), ...variants({ untilNs: 30_000_000 })]));
console.log(`random: ${JSON.stringify(stats)}`);
const corpus = value('corpus');
if (corpus) {
    const records = (await readFile(corpus, 'utf8')).split('\n').filter(Boolean).map(x => JSON.parse(x));
    const seen = new Set();
    for (const [i, r] of records.entries()) {
        const key = JSON.stringify(r);
        if (seen.has(key))
            continue;
        seen.add(key);
        await compare(`corpus ${i} ${r.fn}`, r.sources, () => [labelled(r.fn, (impl, own) => impl[r.fn](own, ...r.args)), labelled('projectModel', (impl, own) => impl.projectModel(own))]);
    }
    console.log(`corpus: ${seen.size} distinct calls of ${records.length}; ${JSON.stringify(stats)}`);
}
console.log(`statuses and observations: ${JSON.stringify(coverage)}`);
console.log('No differences.');
