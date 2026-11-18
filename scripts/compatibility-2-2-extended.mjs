#!/usr/bin/env node
// Extended 2.2 compatibility check (WP1 review F3). The gates of compatibility-2-2.mjs know the repository
// corpus only. test/fixtures/compatibility-2-2-extended/models.json holds further valid and invalid 2.2
// sources, each parsing with the kept 2.2 grammar; recorded.json holds, recorded once from the 3.1.0
// implementation at 213f583, every diagnostic (severity, code, range, message), the digest of the normalized
// AST and, for runnable models, the run or case results with their trace digests. The current implementation
// must reproduce all of it. A run that threw a host error in 3.1.0 is not compared and is listed.
//
//   node scripts/compatibility-2-2-extended.mjs                 check the current build (out/)
//   node scripts/compatibility-2-2-extended.mjs record <root>   record once from a clean, built checkout of
//                                                               213f583 (implementation 3.1.0); refuses when
//                                                               recorded.json exists
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJson, normalizeAst, sourceSha256 } from './compatibility-2-2.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = join(root, 'test', 'fixtures', 'compatibility-2-2-extended');
export const RECORDING_COMMIT = '213f583b14bf9808429b04f7252732a118015576';
const OPTIONS = { untilNs: 100000000 };
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const strip = trace => trace.map(({ profile: _p, languageVersion: _l, ...rest }) => rest);
const at = r => `${r.start.line + 1}:${r.start.character + 1}-${r.end.line + 1}:${r.end.character + 1}`;

/** The observable 2.2 results of every model with the implementation built at buildRoot. */
async function analyse(buildRoot) {
    const base = pathToFileURL(buildRoot.replace(/[\\/]?$/u, '/')).href;
    const { EmptyFileSystem } = await import(base + 'node_modules/langium/lib/index.js');
    const { parseHelper } = await import(base + 'node_modules/langium/lib/test/index.js');
    const { createSwamlServices } = await import(base + 'out/src/language/swaml-module.js');
    const { simulate, runCase } = await import(base + 'out/src/simulation/simulator.js');
    const models = JSON.parse(readFileSync(join(directory, 'models.json'), 'utf8')).models, results = {};
    for (const m of models) {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const document = await parseHelper(Swaml)(m.text, { validation: true });
        const diagnostics = (document.diagnostics ?? []).map(d => `${['', 'error', 'warning', 'information', 'hint'][d.severity ?? 1]} ${d.code ?? '-'} ${at(d.range)} ${d.message}`);
        const result = { sourceSha256: sourceSha256(m.text), diagnostics, astSha256: sha256(canonicalJson(normalizeAst(document.parseResult.value))) };
        const valid = !diagnostics.some(d => d.startsWith('error '));
        const attempt = run => { try { return run(); } catch (error) { return { threw: `${error?.constructor?.name}: ${error?.message}` }; } };
        if (valid && m.target)
            result.run = attempt(() => { const r = simulate([document.parseResult.value], m.target, OPTIONS); const trace = strip(r.trace); return { status: r.status, stores: r.stores, traceLength: trace.length, traceSha256: sha256(canonicalJson(trace)) }; });
        if (valid && m.tests)
            result.cases = Object.fromEntries(m.tests.map(t => [t, attempt(() => { const c = runCase([document.parseResult.value], t, OPTIONS), trace = c.run ? strip(c.run.trace) : []; return { result: c.result, message: c.message ?? null, stores: c.run?.stores ?? null, traceSha256: sha256(canonicalJson(trace)) }; })]));
        results[m.name] = result;
    }
    return results;
}

function record(buildRoot) {
    const file = join(directory, 'recorded.json');
    if (existsSync(file))
        throw Error('recorded.json exists; the extended fixture is recorded once and never re-recorded.');
    const git = (...args) => execFileSync('git', ['-C', buildRoot, ...args], { encoding: 'utf8' }).trim();
    const pkg = JSON.parse(readFileSync(join(buildRoot, 'package.json'), 'utf8')), edition = readFileSync(join(buildRoot, 'src', 'language', 'edition.ts'), 'utf8');
    if (git('rev-parse', 'HEAD') !== RECORDING_COMMIT || pkg.version !== '3.1.0' || git('status', '--porcelain', '--', 'src', 'libraries', 'langium-config.json', 'package.json', 'package-lock.json'))
        throw Error(`Record only from a clean, built checkout of ${RECORDING_COMMIT} (implementation 3.1.0).`);
    return analyse(buildRoot).then(files => {
        const fixture = { rule: 'WP1 review F3: extended 2.2 sources outside the gate-1 corpus', recordedWith: { implementation: pkg.version, commit: RECORDING_COMMIT, languageVersion: /SWAML_LANGUAGE_VERSION = '([^']+)'/u.exec(edition)[1], profile: /SWAML_REFERENCE_PROFILE = '([^']+)'/u.exec(edition)[1], node: process.version, models: `models.json sha256 ${sha256(readFileSync(join(directory, 'models.json'), 'utf8').replaceAll('\r\n', '\n'))}` }, options: OPTIONS, files };
        writeFileSync(file, JSON.stringify({ ...fixture, files: '@' }, null, 2).replace('"files": "@"', '"files": {\n' + Object.entries(files).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }') + '\n');
        return `Recorded ${Object.keys(files).length} extended 2.2 models from ${RECORDING_COMMIT}.`;
    });
}

/** Compares the current build with recorded.json; returns the report and its failures. */
export async function checkExtended() {
    const recorded = JSON.parse(readFileSync(join(directory, 'recorded.json'), 'utf8')), actual = await analyse(root), failures = [], threw = [];
    if (recorded.recordedWith.models !== `models.json sha256 ${sha256(readFileSync(join(directory, 'models.json'), 'utf8').replaceAll('\r\n', '\n'))}`)
        failures.push('models.json differs from the models recorded in recorded.json');
    for (const [name, expected] of Object.entries(recorded.files)) {
        const now = actual[name];
        if (!now) {
            failures.push(`${name}: recorded but no longer in models.json`);
            continue;
        }
        const missing = expected.diagnostics.filter(d => !now.diagnostics.includes(d)), extra = now.diagnostics.filter(d => !expected.diagnostics.includes(d));
        failures.push(...missing.map(d => `${name}: diagnostic expected, absent: ${d}`), ...extra.map(d => `${name}: diagnostic not in 3.1.0: ${d}`));
        if (now.astSha256 !== expected.astSha256)
            failures.push(`${name}: normalized AST differs from 3.1.0`);
        for (const [label, e, a] of [['run', expected.run, now.run], ...Object.keys(expected.cases ?? {}).map(t => [`case ${t}`, expected.cases[t], now.cases?.[t]])]) {
            if (e === undefined && a === undefined)
                continue;
            if (e?.threw) {
                threw.push(`${name} ${label} (3.1.0: ${e.threw})`);
                continue;
            }
            if (canonicalJson(e) !== canonicalJson(a))
                failures.push(`${name}: ${label} differs from 3.1.0: expected ${canonicalJson(e).slice(0, 300)}, actual ${canonicalJson(a ?? null).slice(0, 300)}`);
        }
    }
    const report = `Extended 2.2 compatibility: ${Object.keys(recorded.files).length} models outside the corpus keep their 3.1.0 diagnostics, ASTs and runs; ${failures.length} differences.`
        + (threw.length ? ` Not compared, because 3.1.0 threw a host error: ${threw.join('; ')}.` : '');
    return { report, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    if (process.argv[2] === 'record')
        console.log(await record(process.argv[3]));
    else {
        const { report, failures } = await checkExtended();
        console.log(report);
        if (failures.length) {
            console.error(failures.join('\n'));
            process.exitCode = 1;
        }
    }
}
