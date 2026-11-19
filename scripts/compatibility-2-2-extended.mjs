#!/usr/bin/env node
// Extended 2.2 compatibility check (WP1 review F3). The gates of compatibility-2-2.mjs know the repository
// corpus only. test/fixtures/compatibility-2-2-extended/ holds further valid and invalid 2.2 sources in
// separately pinned sets, each source parsing with the kept 2.2 grammar: models.json (WP1 review F3) and
// models-wp2.json (WP2: view, state, in and out in their keyword roles next to names, if statements and
// single associations), models-wp2b.json (WP2 review: diagnostics that spell a quoted contextual word, compared
// with their related information) and models-wp3.json (WP3-L04: the names of the 3.0 library packages, with
// related information), models-wp3b.json (WP3 review F1: own packages named like the 3.0 library packages) and
// models-wp4.json (WP4: durations in every 2.2 position, policy settings and names that look like units) and
// models-wp5.json (WP5: 2.2 state machines in every 2.2 shape, defer as an ordinary name) and models-wp6.json (WP6: p.m
// references to port members and connection policies in every 2.2 shape). For each set, recorded.json or recorded-wp2.json holds, recorded once from the 3.1.0
// implementation at 213f583, every diagnostic (severity, code, range, message), the digest of the normalized
// AST and, for runnable models, the run or case results with their trace digests. The current implementation
// must reproduce all of it. A run that threw a host error in 3.1.0 is not compared and is listed.
//
// States in the flow (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 7.4): this check is part of gate A, the 2.2 sources
// without a 2.2 state machine. A model whose 2.2 AST (kept 2.2 grammar) holds a machine is excluded and named in the
// report: valid ones are run after migration by gate B (scripts/compatibility-machines.mjs); invalid ones (recorded with
// an error) are syntax errors in 3.0, which no longer parses the 2.2 machine syntax, and are listed as such. The
// specification does not mention invalid 2.2 machine models; excluding and listing them is this script's decision.
//
//   node scripts/compatibility-2-2-extended.mjs                 check the current build (out/), every set
//   node scripts/compatibility-2-2-extended.mjs record <root>   record the first set without a recording, once,
//                                                               from a clean, built checkout of 213f583
//                                                               (implementation 3.1.0); refuses when every set
//                                                               is recorded
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJson, exclusionFailure, machineTest, normalizeAst, parsers, pinnedExclusions, sourceSha256 } from './compatibility-2-2.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = join(root, 'test', 'fixtures', 'compatibility-2-2-extended');
export const RECORDING_COMMIT = '213f583b14bf9808429b04f7252732a118015576';
const OPTIONS = { untilNs: 100000000 };
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
/** The separately pinned model sets, in recording order. A set is recorded once and never re-recorded. */
export const SETS = [
    { models: 'models.json', recorded: 'recorded.json', rule: 'WP1 review F3: extended 2.2 sources outside the gate-1 corpus' },
    { models: 'models-wp2.json', recorded: 'recorded-wp2.json', rule: 'WP2: 2.2 sources with view, state, in and out in their keyword roles next to names, if statements and single associations' },
    // Diagnostics here also carry their related information, which spells names too (WP2 review H1).
    { models: 'models-wp2b.json', recorded: 'recorded-wp2b.json', rule: 'WP2 review H1: 2.2 sources whose diagnostics spell a quoted contextual word', related: true },
    // The 3.0 library packages change the global scope; these 2.2 sources use their names (WP3-L04).
    { models: 'models-wp3.json', recorded: 'recorded-wp3.json', rule: 'WP3-L04: 2.2 sources that declare, import or use the names of the 3.0 library packages', related: true },
    // User packages named like the 3.0 library packages hide them (WP3-L04, WP3 review F1).
    { models: 'models-wp3b.json', recorded: 'recorded-wp3b.json', rule: 'WP3-L04 (review F1): 2.2 sources that declare their own Swaml::Numeric, Swaml::Text or Swaml::Time', related: true },
    // Durations become expression values and PolicySetting has one form (WP4-G01, WP4-G02); these 2.2 sources use
    // every position a duration can have in 2.2.
    { models: 'models-wp4.json', recorded: 'recorded-wp4.json', rule: 'WP4-G01, WP4-G02: 2.2 sources with durations in every 2.2 position, policy settings and names that look like units', related: true },
    // States gain completion, internal and guarded-timer transitions and deferrals, and defer becomes a contextual word
    // (WP5-G01 to WP5-G03); these 2.2 machines must keep the 2.2 reaction order (WP5-R11) and defer stays a name.
    { models: 'models-wp5.json', recorded: 'recorded-wp5.json', rule: 'WP5-G01 to WP5-G03, WP5-R11: 2.2 state machines in every 2.2 shape and defer as an ordinary name', related: true },
    // Ports opt in to sampled reads by initial values and connections gain member policies (WP6-G01, WP6-G02); these
    // 2.2 sources read p.m in every 2.2 position (an unknown local value) and use connection policies in every 2.2 shape.
    { models: 'models-wp6.json', recorded: 'recorded-wp6.json', rule: 'WP6-G01, WP6-G02, WP6-S01: 2.2 sources with p.m references to port members and connection policies in every 2.2 shape', related: true },
    // Swaml::Os becomes a library package, deploy paths may end at released operations and Tasks order equal-time work
    // (WP8-L01, WP8-S01, WP8-R01); these 2.2 sources use task-shaped platforms, own Swaml::Os packages, the names of
    // the library's declarations and every 2.2 deploy path shape that stays invalid or keeps its meaning.
    { models: 'models-wp8.json', recorded: 'recorded-wp8.json', rule: 'WP8-L01, WP8-S01, WP8-R01: 2.2 deployments on task-shaped platforms, own Swaml::Os packages and deploy paths in every 2.2 shape', related: true },
];
const strip = trace => trace.map(({ profile: _p, languageVersion: _l, ...rest }) => rest);
const at = r => `${r.start.line + 1}:${r.start.character + 1}-${r.end.line + 1}:${r.end.character + 1}`;

/** The observable 2.2 results of every model with the implementation built at buildRoot. */
async function analyse(buildRoot, set, skip = () => false) {
    const base = pathToFileURL(buildRoot.replace(/[\\/]?$/u, '/')).href;
    const { EmptyFileSystem } = await import(base + 'node_modules/langium/lib/index.js');
    const { parseHelper } = await import(base + 'node_modules/langium/lib/test/index.js');
    const { createSwamlServices } = await import(base + 'out/src/language/swaml-module.js');
    const { simulate, runCase } = await import(base + 'out/src/simulation/simulator.js');
    const models = JSON.parse(readFileSync(join(directory, set.models), 'utf8')).models, results = {};
    for (const [index, m] of models.entries()) {
        if (skip(m))
            continue;
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        // Traces name the document URI. Each set was recorded in a fresh process, where parseHelper numbered
        // its documents file:///1.swaml, file:///2.swaml and so on; that URI is given explicitly, so that a
        // set's results do not depend on the sets analysed before it in the same process.
        const document = await parseHelper(Swaml)(m.text, { validation: true, documentUri: `file:///${index + 1}.swaml` });
        const diagnostics = (document.diagnostics ?? []).map(d => `${['', 'error', 'warning', 'information', 'hint'][d.severity ?? 1]} ${d.code ?? '-'} ${at(d.range)} ${d.message}${set.related && d.relatedInformation?.length ? ' | related: ' + d.relatedInformation.map(r => r.message).join(' / ') : ''}`);
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
    const set = SETS.find(x => !existsSync(join(directory, x.recorded)));
    if (!set)
        throw Error('Every set is recorded; the extended fixture is recorded once and never re-recorded.');
    const file = join(directory, set.recorded);
    const git = (...args) => execFileSync('git', ['-C', buildRoot, ...args], { encoding: 'utf8' }).trim();
    const pkg = JSON.parse(readFileSync(join(buildRoot, 'package.json'), 'utf8')), edition = readFileSync(join(buildRoot, 'src', 'language', 'edition.ts'), 'utf8');
    if (git('rev-parse', 'HEAD') !== RECORDING_COMMIT || pkg.version !== '3.1.0' || git('status', '--porcelain', '--', 'src', 'libraries', 'langium-config.json', 'package.json', 'package-lock.json'))
        throw Error(`Record only from a clean, built checkout of ${RECORDING_COMMIT} (implementation 3.1.0).`);
    return analyse(buildRoot, set).then(files => {
        const fixture = { rule: set.rule, recordedWith: { implementation: pkg.version, commit: RECORDING_COMMIT, languageVersion: /SWAML_LANGUAGE_VERSION = '([^']+)'/u.exec(edition)[1], profile: /SWAML_REFERENCE_PROFILE = '([^']+)'/u.exec(edition)[1], node: process.version, models: `${set.models} sha256 ${sha256(readFileSync(join(directory, set.models), 'utf8').replaceAll('\r\n', '\n'))}` }, options: OPTIONS, files };
        writeFileSync(file, JSON.stringify({ ...fixture, files: '@' }, null, 2).replace('"files": "@"', '"files": {\n' + Object.entries(files).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }') + '\n');
        return `Recorded ${Object.keys(files).length} extended 2.2 models of ${set.models} from ${RECORDING_COMMIT}.`;
    });
}

/** Compares the current build with every recorded set; returns the report and its failures. */
export async function checkExtended() {
    const failures = [], threw = [], counts = [], excludedValid = [], excludedInvalid = [], hasMachine = machineTest((await parsers()).v22);
    for (const set of SETS) {
        const all = JSON.parse(readFileSync(join(directory, set.recorded), 'utf8'));
        const machines = new Set(JSON.parse(readFileSync(join(directory, set.models), 'utf8')).models.filter(m => hasMachine(m.text)).map(m => m.name));
        for (const name of machines)
            (all.files[name]?.diagnostics.some(d => d.startsWith('error ')) ? excludedInvalid : excludedValid).push(`${set.models} ${name}`);
        const recorded = { ...all, files: Object.fromEntries(Object.entries(all.files).filter(([name]) => !machines.has(name))) };
        const actual = await analyse(root, set, m => machines.has(m.name));
        counts.push(`${Object.keys(recorded.files).length} of ${set.models}`);
        if (recorded.recordedWith.models !== `${set.models} sha256 ${sha256(readFileSync(join(directory, set.models), 'utf8').replaceAll('\r\n', '\n'))}`)
            failures.push(`${set.models} differs from the models recorded in ${set.recorded}`);
        compare(recorded, actual, failures, threw);
    }
    const report = `Extended 2.2 compatibility: ${counts.join(' and ')} models outside the corpus keep their 3.1.0 diagnostics, ASTs and runs; ${failures.length} differences.`
        + (threw.length ? ` Not compared, because 3.1.0 threw a host error: ${threw.join('; ')}.` : '')
        + `\nExcluded, 2.2 models with a state machine: ${excludedValid.length} valid (gate B runs them after migration)${excludedValid.length ? ': ' + excludedValid.join(', ') : ''}; `
        + `${excludedInvalid.length} invalid (recorded with an error; syntax errors in 3.0)${excludedInvalid.length ? ': ' + excludedInvalid.join(', ') : ''}.`;
    const pinned = pinnedExclusions();
    failures.push(...exclusionFailure('extended, valid', excludedValid, pinned.extendedValid), ...exclusionFailure('extended, invalid', excludedInvalid, pinned.extendedInvalid));
    return { report, failures };
}
/** Compares one recorded set with the current results, collecting failures and runs that threw in 3.1.0. */
function compare(recorded, actual, failures, threw) {
    for (const [name, expected] of Object.entries(recorded.files)) {
        const now = actual[name];
        if (!now) {
            failures.push(`${name}: recorded but no longer in its models file`);
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
