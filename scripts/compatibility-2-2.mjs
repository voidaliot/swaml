// Compatibility gates 1 and 2 of swa.ml 2.3 (rules WP1a-M01 and WP1a-M02 of docs/drafts/2.3/grammar.md):
// every valid 2.2 source keeps its AST and its behaviour. Both compare with fixtures under
// test/fixtures/compatibility-2-2/, recorded once with the 3.1.0 implementation (standard 2.2, profile
// swaml-reference/2.2) at the commit each fixture names, before any 2.3 change.
//
//   node scripts/compatibility-2-2.mjs ast             gate 1 (also run by test/v2/compatibility-2-2.test.ts)
//   node scripts/compatibility-2-2.mjs runs            gate 2 (run by npm run check)
//   node scripts/compatibility-2-2.mjs runs --write-traces <dir>   also writes every actual trace
//   node scripts/compatibility-2-2.mjs ast|runs --record           records a fixture; only on the recorded implementation
//
// Gate 1 parses every repository .swaml file with the 2.2 grammar kept as swaml-2.2.langium and with the
// current grammar, and compares the ASTs after normalization N1 (see normalizeAst). ast.json holds the
// SHA-256 of each recorded file's normalized 2.2 AST, so that the kept grammar is itself checked against
// what the 3.1.0 parser produced. Gate 2 reruns every recorded run and case with its recorded options and
// compares status, full final stores, machines, deployments, verdict and message, trace length, per-kind
// counts and the SHA-256 of the canonical JSON trace (UTF-8, object keys sorted, no whitespace), with
// `profile` and `languageVersion` removed.
//
// Recorded sources: a fixture names the SHA-256 of every source it was recorded from. A gate always checks
// the recorded source. When a later package deliberately changes such a file, it keeps the recorded bytes
// at test/fixtures/compatibility-2-2/sources/<path>, where the gates look first; otherwise the gate fails.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const fixtureDirectory = 'test/fixtures/compatibility-2-2';
const fixturePath = path => join(root, ...fixtureDirectory.split('/'), ...path.split('/'));
const read = path => readFileSync(join(root, ...path.split('/')), 'utf8');
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
/** A source's digest, with CRLF normalized to LF as .gitattributes checks sources out. */
export const sourceSha256 = text => sha256(text.replaceAll('\r\n', '\n'));

/** JSON with object keys sorted at every depth and no whitespace. */
export function canonicalJson(value) {
    return JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}

/** The bytes a fixture was recorded from: the workspace file, or its kept copy under sources/. */
export function recordedSource(path, expectedSha256) {
    for (const [file, from] of [[join(root, ...path.split('/')), path], [fixturePath('sources/' + path), `${fixtureDirectory}/sources/${path}`]]) {
        if (!existsSync(file))
            continue;
        const text = readFileSync(file, 'utf8');
        if (sourceSha256(text) === expectedSha256)
            return { text, from };
    }
    return undefined;
}
const missingSource = (path, expected) => `${path}: the recorded source (sha256 ${expected}) is neither the workspace file nor ${fixtureDirectory}/sources/${path}. `
    + 'A package that changes a recorded source keeps the recorded bytes there, so that the gate still checks them.';

/** Every repository .swaml file (tracked or untracked, not ignored), except kept fixture sources. */
export function corpus() {
    const listed = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '--', '*.swaml'], { encoding: 'utf8' });
    return [...new Set(listed.split('\n').map(x => x.trim()).filter(Boolean))].filter(p => !p.startsWith(fixtureDirectory + '/')).sort();
}

// ---------------------------------------------------------------- gate 1: AST identity

/**
 * The compared form of an AST: $type and properties only, keys sorted, references as their text
 * ({$ref}), positions, containers and other $ properties removed, and empty defaults (undefined,
 * false, empty arrays) stripped. Then N1, the single normalization, applied to both sides:
 * PolicySetting{duration: d} becomes PolicySetting{value: Literal{duration: d}}.
 */
export function normalizeAst(node) {
    if (Array.isArray(node))
        return node.map(normalizeAst);
    if (!node || typeof node !== 'object')
        return node;
    if ('$refText' in node)
        return { $ref: node.$refText };
    const out = {};
    for (const key of Object.keys(node).sort()) {
        const value = node[key];
        if (key.startsWith('$') && key !== '$type' || value === undefined || value === false || Array.isArray(value) && !value.length)
            continue;
        out[key] = normalizeAst(value);
    }
    if (out.$type === 'PolicySetting' && 'duration' in out) {
        const { duration, ...rest } = out;
        return Object.fromEntries(Object.entries({ ...rest, value: { $type: 'Literal', duration } }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return out;
}

/** Up to limit differences between two normalized ASTs, as path: expected / actual. */
export function astDifferences(expected, actual, limit = 40, path = '$', out = []) {
    if (out.length >= limit)
        return out;
    const show = v => { const s = v === undefined ? 'absent' : JSON.stringify(v); return s.length > 160 ? s.slice(0, 157) + '...' : s; };
    if (expected && actual && typeof expected === 'object' && typeof actual === 'object' && Array.isArray(expected) === Array.isArray(actual)) {
        if (Array.isArray(expected)) {
            if (expected.length !== actual.length)
                out.push(`${path}.length: expected ${expected.length}, actual ${actual.length}`);
            for (let i = 0; i < Math.min(expected.length, actual.length); i++)
                astDifferences(expected[i], actual[i], limit, `${path}[${i}]`, out);
        }
        else
            for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort())
                astDifferences(expected[key], actual[key], limit, `${path}.${key}`, out);
    }
    else if (canonicalJson(expected) !== canonicalJson(actual))
        out.push(`${path}: expected ${show(expected)}, actual ${show(actual)}`);
    return out.slice(0, limit);
}

/** Parsers for the kept 2.2 grammar and for the current grammar. */
export async function parsers() {
    const { EmptyFileSystem } = await import('langium');
    const { createServicesForGrammar } = await import('langium/grammar');
    const { createSwamlServices } = await import('../out/src/language/swaml-module.js');
    const { SwamlValueConverter } = await import('../out/src/language/swaml-syntax.js');
    const grammar22 = readFileSync(fixturePath('swaml-2.2.langium'), 'utf8');
    const kept = await createServicesForGrammar({ grammar: grammar22, module: { parser: { ValueConverter: () => new SwamlValueConverter() } } });
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const parse = parser => text => {
        const result = parser.parse(text), errors = [...result.lexerErrors, ...result.parserErrors];
        return errors.length ? { errors: errors.map(e => `${e.token?.startLine ?? e.line ?? '?'}:${e.token?.startColumn ?? e.column ?? '?'} ${e.message}`) } : { ast: normalizeAst(result.value) };
    };
    return { kept, grammarSha256: sha256(grammar22.replaceAll('\r\n', '\n')), v22: parse(kept.parser.LangiumParser), current: parse(Swaml.parser.LangiumParser) };
}

/** Records ast.json from the current implementation; refuses unless the current grammar equals the kept 2.2 grammar. */
async function recordAst() {
    const identity = recordingIdentity();
    const grammar = read('src/language/swaml.langium').replaceAll('\r\n', '\n');
    const { grammarSha256, current } = await parsers();
    if (sha256(grammar) !== grammarSha256)
        throw Error('Record gate 1 only with the 2.2 grammar: src/language/swaml.langium differs from the kept swaml-2.2.langium.');
    const files = {};
    for (const path of corpus()) {
        const text = read(path), parsed = current(text);
        files[path] = parsed.errors
            ? { sourceSha256: sourceSha256(text), skipped: '2.2 parse errors: ' + parsed.errors.slice(0, 3).join('; ') }
            : { sourceSha256: sourceSha256(text), astSha256: sha256(canonicalJson(parsed.ast)) };
    }
    const fixture = { rule: 'WP1a-M01', recordedWith: identity, grammar: `${fixtureDirectory}/swaml-2.2.langium`, grammarSha256,
        normalization: 'Compared form: $type and properties, keys sorted, references as {$ref: text}, $-properties and empty defaults (undefined, false, []) removed; N1 rewrites PolicySetting{duration: d} to PolicySetting{value: Literal{duration: d}} on both sides.',
        astDigest: 'SHA-256 of the compared form as canonical JSON (UTF-8, object keys sorted, no whitespace).', files };
    writeFileSync(fixturePath('ast.json'), JSON.stringify(fixture, null, 2) + '\n');
    return `Recorded gate 1: ${Object.keys(files).length} files, ${Object.values(files).filter(f => f.skipped).length} skipped with 2.2 parse errors.`;
}

/**
 * Name resolution and validity of one source, as gate 1 records them: every cross-reference with its
 * position, its owner property, its text and the identity of its target (type, the path of names, or of
 * owner properties for unnamed nodes, from the model root, and the defining document when it is another
 * one, or 'unresolved'); every diagnostic with severity, code, range and message; and the inferred type of
 * every typed expression, keyed by offset and node type. The source is linked and validated alone, with
 * the built-in library, as the example gate loads it.
 */
export async function analyser() {
    const { AstUtils, EmptyFileSystem } = await import('langium');
    const { parseHelper } = await import('langium/test');
    const { createSwamlServices } = await import('../out/src/language/swaml-module.js');
    const { expressionTypes } = await import('../out/src/language/semantic.js');
    return async (path, text) => {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const document = await parseHelper(Swaml)(text, { documentUri: `file:///${path}`, validation: true });
        const self = document.uri.toString();
        const at = range => `${range.start.line + 1}:${range.start.character + 1}`;
        const target = node => {
            const parts = [];
            for (let x = node; x?.$container; x = x.$container)
                parts.unshift(typeof x.name === 'string' ? x.name : `${x.$containerProperty}[${x.$containerIndex ?? ''}]`);
            const uri = AstUtils.getDocument(node).uri.toString();
            return `${node.$type} ${parts.join('/')}${uri === self ? '' : ' @' + uri}`;
        };
        const references = [], types = {};
        for (const node of AstUtils.streamAst(document.parseResult.value)) {
            for (const ref of AstUtils.streamReferences(node)) {
                const reference = ref.reference, resolvedNode = reference.ref;
                references.push(`${reference.$refNode ? at(reference.$refNode.range) : '?'} ${ref.container.$type}.${ref.property} ${reference.$refText} -> ${resolvedNode ? target(resolvedNode) : 'unresolved'}`);
            }
            const type = expressionTypes.get(node);
            if (type !== undefined && node.$cstNode)
                types[`${node.$cstNode.offset} ${node.$type}`] = type;
        }
        const diagnostics = (document.diagnostics ?? []).map(d => `${['', 'error', 'warning', 'information', 'hint'][d.severity ?? 1]} ${d.code ?? '-'} ${at(d.range)}-${d.range.end.line + 1}:${d.range.end.character + 1} ${d.message}`);
        return { references, diagnostics, types };
    };
}

/** Differences of references, diagnostics and expression types; expressions that 3.1.0 did not type are not compared. */
function resolutionDifferences(expected, actual, limit = 30) {
    const out = [];
    const list = (label, e, a) => {
        const missing = e.filter(x => !a.includes(x)), extra = a.filter(x => !e.includes(x));
        out.push(...missing.slice(0, limit).map(x => `${label} expected, absent: ${x}`), ...extra.slice(0, limit).map(x => `${label} not in 3.1.0: ${x}`));
        if (!missing.length && !extra.length && canonicalJson(e) !== canonicalJson(a))
            out.push(`${label}s in another order`);
    };
    list('reference', expected.references, actual.references);
    list('diagnostic', expected.diagnostics, actual.diagnostics);
    for (const [key, type] of Object.entries(expected.types))
        if (actual.types[key] !== type && out.length < 3 * limit)
            out.push(`expression type at offset ${key}: expected ${type}, actual ${actual.types[key] ?? 'none'}`);
    return out;
}

/** Records resolution.json from the 3.1.0 implementation, once: references, diagnostics and types of every corpus file. */
async function recordResolution() {
    const identity = recordingIdentity(), { current } = await parsers(), analyse = await analyser(), files = {};
    for (const path of corpus()) {
        const text = read(path), parsed = current(text);
        files[path] = { sourceSha256: sourceSha256(text), ...(parsed.errors ? { skipped: '2.2 parse errors: ' + parsed.errors.slice(0, 3).join('; ') } : { astSha256: sha256(canonicalJson(parsed.ast)) }), ...await analyse(path, text) };
    }
    const fixture = { rule: 'WP1a-M01 (resolution and validity)', recordedWith: { ...identity, script: `scripts/compatibility-2-2.mjs sha256 ${sourceSha256(read('scripts/compatibility-2-2.mjs'))}` },
        format: 'Per corpus file: source and AST digests as in ast.json; references as "line:column Owner.property text -> TargetType path[ @document]"; diagnostics as "severity code start-end message"; types as {"offset NodeType": inferred type}.',
        files };
    const head = JSON.stringify({ ...fixture, files: '@' }, null, 2);
    const body = '{\n' + Object.entries(files).map(([p, f]) => `    ${JSON.stringify(p)}: ${JSON.stringify(f)}`).join(',\n') + '\n  }';
    writeFileSync(fixturePath('resolution.json'), head.replace('"files": "@"', '"files": ' + body) + '\n');
    const total = key => Object.values(files).reduce((n, f) => n + (Array.isArray(f[key]) ? f[key].length : Object.keys(f[key]).length), 0);
    return `Recorded gate 1 resolution: ${Object.keys(files).length} files, ${total('references')} references, ${total('diagnostics')} diagnostics, ${total('types')} typed expressions.`;
}

/**
 * Gate 1. Every recorded file's recorded source must parse with the current grammar and with the kept
 * 2.2 grammar to its recorded AST digest; every current corpus file that parses with the 2.2 grammar
 * must parse to the same AST with the current grammar. Returns the report and its failures.
 */
export async function checkAst() {
    const fixture = JSON.parse(readFileSync(fixturePath('ast.json'), 'utf8'));
    // resolution.json, recorded once later from the same 3.1.0 commit, adds files that ast.json does not hold.
    const resolution = existsSync(fixturePath('resolution.json')) ? JSON.parse(readFileSync(fixturePath('resolution.json'), 'utf8')) : undefined;
    const recordedFiles = { ...Object.fromEntries(Object.entries(resolution?.files ?? {}).map(([p, f]) => [p, { sourceSha256: f.sourceSha256, ...(f.skipped ? { skipped: f.skipped } : { astSha256: f.astSha256 }) }])), ...fixture.files };
    const { grammarSha256, v22, current } = await parsers();
    const failures = [], skipped = new Map(), compared = new Set(), identical = new Set();
    if (grammarSha256 !== fixture.grammarSha256)
        failures.push(`The kept 2.2 grammar changed: sha256 ${grammarSha256}, recorded ${fixture.grammarSha256}. The 2.2 grammar fixture is never edited.`);
    // label names the bytes compared: the workspace path, or the kept copy of a recorded source.
    const compare = (path, label, text, recorded) => {
        const old = v22(text), now = current(text), before = failures.length;
        compared.add(path);
        if (old.errors) {
            if (recorded && !recorded.skipped)
                failures.push(`${label}: the kept 2.2 grammar no longer parses the recorded source: ${old.errors.slice(0, 3).join('; ')}`);
            skipped.set(label, old.errors[0]);
            return;
        }
        if (recorded?.skipped)
            failures.push(`${label}: recorded as a 2.2 parse error, but the kept 2.2 grammar now parses it`);
        if (now.errors)
            return failures.push(`${label}: parses with the 2.2 grammar but not with the current grammar: ${now.errors.slice(0, 3).join('; ')}`);
        const oldDigest = sha256(canonicalJson(old.ast)), nowDigest = sha256(canonicalJson(now.ast));
        if (recorded && oldDigest !== recorded.astSha256)
            failures.push(`${label}: the kept 2.2 grammar no longer reproduces the recorded 3.1.0 AST (digest ${oldDigest}, recorded ${recorded.astSha256})`);
        if (oldDigest !== nowDigest || recorded && nowDigest !== recorded.astSha256)
            failures.push(`${label}: AST differs from 2.2 after N1 (2.2 digest ${oldDigest}, current ${nowDigest}${recorded ? `, recorded ${recorded.astSha256}` : ''}):\n    `
                + (astDifferences(old.ast, now.ast).join('\n    ') || '(the kept 2.2 grammar and the current grammar agree; both differ from the recorded 3.1.0 digest, so shared parsing code such as the value converter changed; rebuild the recorded commit to see its AST)'));
        if (failures.length === before)
            identical.add(label);
    };
    for (const [path, recorded] of Object.entries(recordedFiles)) {
        const source = recordedSource(path, recorded.sourceSha256);
        if (!source)
            failures.push(missingSource(path, recorded.sourceSha256));
        else
            compare(path, source.from, source.text, recorded);
    }
    for (const path of corpus()) {
        const text = read(path);
        if (recordedFiles[path]?.sourceSha256 !== sourceSha256(text))
            compare(path, path, text, undefined);
    }
    let resolved = 0;
    if (!resolution)
        failures.push(`Missing ${fixtureDirectory}/resolution.json, the recorded references, diagnostics and expression types.`);
    else {
        if (resolution.recordedWith.commit !== fixture.recordedWith.commit)
            failures.push(`resolution.json was recorded at ${resolution.recordedWith.commit}, ast.json at ${fixture.recordedWith.commit}; both must name the same 3.1.0 commit.`);
        const analyse = await analyser();
        for (const [path, recorded] of Object.entries(resolution.files)) {
            const source = recordedSource(path, recorded.sourceSha256);
            if (!source)
                continue; // already reported as a missing recorded source
            const differences = resolutionDifferences(recorded, await analyse(path, source.text));
            if (differences.length)
                failures.push(`${source.from}: name resolution or validation differs from 3.1.0:\n    ${differences.join('\n    ')}`);
            else
                resolved++;
        }
    }
    const report = `Gate 1 (AST identity under N1): ${identical.size} sources identical to 2.2, ${skipped.size} skipped with 2.2 parse errors`
        + (skipped.size ? ` (${[...skipped.keys()].join(', ')})` : '') + `; ${resolved} sources keep the recorded references, diagnostics and expression types; ${failures.length} differences.`;
    return { report, failures, compared: [...compared], skipped: [...skipped.keys()] };
}

// ---------------------------------------------------------------- gate 2: behaviour identity

const IGNORED = ['profile', 'languageVersion'];
const without = (object, keys) => Object.fromEntries(Object.entries(object).filter(([k]) => !keys.includes(k)));
/** The trace compared by gate 2: every observation with profile and languageVersion removed. */
export const comparedTrace = trace => trace.map(event => without(event, IGNORED));

/** The compared summary of one run: everything but options, sources and the trace itself, plus the trace digest. */
function runSummary(run) {
    const trace = comparedTrace(run.trace), kinds = {};
    for (const event of trace)
        kinds[event.kind] = (kinds[event.kind] ?? 0) + 1;
    // run.options holds the options the run applied, with the simulator's defaults filled in.
    const { options, sources: _sources, trace: _trace, ...rest } = without(run, IGNORED);
    return { summary: { ...rest, resolvedOptions: options, traceLength: trace.length, traceKinds: Object.fromEntries(Object.entries(kinds).sort()), traceSha256: sha256(canonicalJson(trace)) }, trace };
}
/** The compared result of one case: its verdict fields and, for an executable case, its run. */
function caseSummary(result) {
    const { run, ...fields } = result;
    return run ? { fields: without(fields, IGNORED), ...runSummary(run) } : { fields: without(fields, IGNORED) };
}

async function loader() {
    const { EmptyFileSystem } = await import('langium');
    const { parseHelper } = await import('langium/test');
    const { createSwamlServices } = await import('../out/src/language/swaml-module.js');
    return async (model, text) => {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const document = await parseHelper(Swaml)(text, { documentUri: `file:///${model}`, validation: true });
        const errors = document.diagnostics?.filter(d => d.severity === 1) ?? [];
        if (errors.length)
            throw Error(`${model}: ${errors.map(e => e.message).join('; ')}`);
        return [document.parseResult.value];
    };
}
async function walk(directory) {
    const files = [];
    for (const e of readdirSync(join(root, ...directory.split('/')), { withFileTypes: true })) {
        if (e.name === 'invalid')
            continue;
        if (e.isDirectory())
            files.push(...await walk(directory + e.name + '/'));
        else if (e.name.endsWith('.swaml'))
            files.push(directory + e.name);
    }
    return files;
}

/** The runs of runs.json and every case of every complete example, with their resolved options. */
async function currentSubjects() {
    const { caseOptions } = await import('./simulation-cases.mjs');
    const runs = JSON.parse(read('examples/simulation/runs.json')), cases = JSON.parse(read('examples/simulation/cases.json'));
    const subjects = runs.map(run => ({ id: `run ${run.case ?? run.target} of ${run.model}`, model: run.model, ...(run.case ? { case: run.case } : { target: run.target }), options: JSON.parse(read(run.options)) }));
    for (const model of (await walk('examples/')).sort())
        subjects.push({ id: `cases of ${model}`, model, tests: true, options: caseOptions(cases, model) });
    return subjects;
}

/** Runs one subject and yields [id, summary, trace] for each result. */
async function* execute(subject, text, load) {
    const { runCase, eachTest, simulate } = await import('../out/src/simulation/simulator.js');
    const models = await load(subject.model, text);
    if (subject.tests) {
        for (const result of eachTest(models, subject.options))
            yield [`case ${result.case} of ${subject.model}`, caseSummary(result)];
    }
    else if (subject.case)
        yield [subject.id, caseSummary(runCase(models, subject.case, subject.options))];
    else
        yield [subject.id, runSummary(simulate(models, subject.target, subject.options))];
}

function recordingIdentity() {
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    const implementation = ['src', 'libraries', 'langium-config.json', 'package-lock.json'];
    const pkg = JSON.parse(read('package.json')), committed = JSON.parse(git('show', 'HEAD:package.json')), edition = read('src/language/edition.ts');
    const manifest = p => canonicalJson([p.version, p.dependencies, p.devDependencies, p.exports]);
    if (git('status', '--porcelain', '--', ...implementation) || manifest(pkg) !== manifest(committed))
        throw Error('Record only from a committed implementation: src, libraries, the lockfile or the package version and dependencies have uncommitted changes.');
    return { implementation: pkg.version, commit: git('rev-parse', 'HEAD'), languageVersion: /SWAML_LANGUAGE_VERSION = '([^']+)'/.exec(edition)[1],
        profile: /SWAML_REFERENCE_PROFILE = '([^']+)'/.exec(edition)[1], node: process.version };
}

async function recordRuns() {
    const identity = recordingIdentity(), load = await loader(), sources = {}, entries = [];
    for (const subject of await currentSubjects()) {
        const text = read(subject.model);
        sources[subject.model] = sourceSha256(text);
        for await (const [id, actual] of execute(subject, text, load))
            entries.push({ id, kind: subject.tests ? 'case' : 'run', model: subject.model, ...(subject.target ? { target: subject.target } : { case: subject.case ?? actual.fields.case }),
                options: subject.options, ...(actual.fields ? { verdict: actual.fields } : {}), ...(actual.summary ? { run: actual.summary } : {}) });
    }
    const fixture = { rule: 'WP1a-M02', recordedWith: identity, ignored: IGNORED,
        traceDigest: 'SHA-256 of the trace as canonical JSON (UTF-8, object keys sorted, no whitespace) after profile and languageVersion are removed from every observation.',
        sources: Object.fromEntries(Object.entries(sources).sort()), entries };
    // One entry per line: the full stores make the file large, and a line per run or case keeps it diffable.
    const text = JSON.stringify({ ...fixture, entries: [] }, null, 2).replace(/"entries": \[\]\n\}$/u, '"entries": [\n' + entries.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}');
    writeFileSync(fixturePath('behaviour.json'), text + '\n');
    return `Recorded gate 2: ${entries.length} runs and cases from ${Object.keys(sources).length} models.`;
}

/** Every difference between a recorded and an actual summary, store by store and key by key. */
function summaryDifferences(expected, actual) {
    const out = [], show = v => v === undefined ? 'absent' : JSON.stringify(v);
    const keyed = (label, e = {}, a = {}) => {
        for (const key of [...new Set([...Object.keys(e), ...Object.keys(a)])].sort())
            if (canonicalJson(e[key]) !== canonicalJson(a[key]))
                out.push(`${label} ${key}: expected ${show(e[key])}, actual ${show(a[key])}`);
    };
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
        if (canonicalJson(expected[key]) === canonicalJson(actual[key]))
            continue;
        if (key === 'stores')
            for (const component of [...new Set([...Object.keys(expected.stores ?? {}), ...Object.keys(actual.stores ?? {})])].sort())
                keyed(`store ${component}:`, expected.stores?.[component] ?? {}, actual.stores?.[component] ?? {});
        else if (key === 'machines' || key === 'deployments' || key === 'traceKinds')
            keyed(key === 'traceKinds' ? 'trace kind count' : key.slice(0, -1), expected[key], actual[key]);
        else if (key !== 'traceSha256' && key !== 'traceLength')
            out.push(`${key}: expected ${show(expected[key])}, actual ${show(actual[key])}`);
    }
    if (expected.traceSha256 !== actual.traceSha256)
        out.push(`trace: expected sha256 ${expected.traceSha256} (${expected.traceLength} observations), actual sha256 ${actual.traceSha256} (${actual.traceLength} observations)`);
    return out;
}

/** A run entry is its own subject; the case entries of one model run together, as swaml test runs them. */
function subjectsOf(entries) {
    const subjects = new Map();
    for (const entry of entries) {
        const key = entry.kind === 'run' ? entry.id : `cases of ${entry.model}`;
        if (!subjects.has(key))
            subjects.set(key, entry.kind === 'run' ? { id: entry.id, model: entry.model, ...(entry.target ? { target: entry.target } : { case: entry.case }), options: entry.options }
                : { id: key, model: entry.model, tests: true, options: entry.options });
    }
    return subjects;
}

/**
 * Records behaviour-supplement.json once, from the 3.1.0 implementation: the resolved options of every
 * behaviour.json entry, which that fixture did not keep, and the complete entries of every example model
 * that behaviour.json does not hold (the gate-2 coverage example added in WP1a).
 */
async function recordRunsSupplement() {
    const identity = recordingIdentity(), load = await loader(), base = JSON.parse(readFileSync(fixturePath('behaviour.json'), 'utf8'));
    if (identity.commit !== base.recordedWith.commit)
        throw Error(`Record the supplement at the commit behaviour.json names, ${base.recordedWith.commit}; this is ${identity.commit}.`);
    const resolvedOptions = {}, sources = {}, entries = [];
    for (const subject of subjectsOf(base.entries).values()) {
        const source = recordedSource(subject.model, base.sources[subject.model]);
        for await (const [id, actual] of execute(subject, source.text, load))
            if (actual.summary)
                resolvedOptions[id] = actual.summary.resolvedOptions;
    }
    for (const subject of (await currentSubjects()).filter(s => !base.sources[s.model])) {
        const text = read(subject.model);
        sources[subject.model] = sourceSha256(text);
        for await (const [id, actual] of execute(subject, text, load))
            entries.push({ id, kind: subject.tests ? 'case' : 'run', model: subject.model, ...(subject.target ? { target: subject.target } : { case: subject.case ?? actual.fields.case }),
                options: subject.options, ...(actual.fields ? { verdict: actual.fields } : {}), ...(actual.summary ? { run: actual.summary } : {}) });
    }
    const fixture = { rule: 'WP1a-M02 (supplement)', recordedWith: { ...identity, script: `scripts/compatibility-2-2.mjs sha256 ${sourceSha256(read('scripts/compatibility-2-2.mjs'))}` }, ignored: IGNORED,
        resolvedOptions, sources: Object.fromEntries(Object.entries(sources).sort()), entries: '@' };
    const text = JSON.stringify(fixture, null, 2).replace('"entries": "@"', '"entries": [\n' + entries.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]');
    writeFileSync(fixturePath('behaviour-supplement.json'), text + '\n');
    return `Recorded gate 2 supplement: resolved options of ${Object.keys(resolvedOptions).length} recorded runs; ${entries.length} runs and cases from ${Object.keys(sources).length} added models.`;
}

/** Gate 2. Reruns every recorded entry from its recorded source and options and compares it. */
export async function checkRuns({ writeTraces } = {}) {
    const base = JSON.parse(readFileSync(fixturePath('behaviour.json'), 'utf8')), load = await loader(), failures = [];
    const supplementFile = fixturePath('behaviour-supplement.json'), supplement = existsSync(supplementFile) ? JSON.parse(readFileSync(supplementFile, 'utf8')) : undefined;
    if (!supplement)
        failures.push(`Missing ${fixtureDirectory}/behaviour-supplement.json, the recorded resolved options and the coverage example.`);
    else if (supplement.recordedWith.commit !== base.recordedWith.commit)
        failures.push(`behaviour-supplement.json was recorded at ${supplement.recordedWith.commit}, behaviour.json at ${base.recordedWith.commit}; both must name the same 3.1.0 commit.`);
    // The base entries gain the resolved options the supplement recorded for them.
    const fixture = { ...base, sources: { ...base.sources, ...supplement?.sources },
        entries: [...base.entries.map(e => e.run ? { ...e, run: { ...e.run, resolvedOptions: supplement?.resolvedOptions?.[e.id] } } : e), ...supplement?.entries ?? []] };
    const seen = new Set(), recorded = new Map(fixture.entries.map(e => [e.id, e]));
    const traceDirectory = writeTraces ?? join(root, 'out', 'compatibility-2-2');
    const writeTrace = (id, trace) => {
        const file = join(traceDirectory, id.replace(/[^\w.-]+/g, '_').slice(0, 150) + '.trace.json');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(trace, null, 1) + '\n');
        return file;
    };
    const subjects = subjectsOf(fixture.entries);
    for (const subject of subjects.values()) {
        const source = recordedSource(subject.model, fixture.sources[subject.model]);
        if (!source) {
            failures.push(missingSource(subject.model, fixture.sources[subject.model]));
            continue;
        }
        try {
            for await (const [id, actual] of execute(subject, source.text, load)) {
                seen.add(id);
                const expected = recorded.get(id);
                if (writeTraces && actual.trace)
                    writeTrace(id, actual.trace);
                if (!expected) {
                    failures.push(`${id}: not in the 2.2 fixture (a case was added to a recorded source)`);
                    continue;
                }
                const differences = [
                    ...summaryDifferences(expected.verdict ?? {}, actual.fields ?? {}).map(d => 'verdict ' + d),
                    ...summaryDifferences(expected.run ?? {}, actual.summary ?? {}),
                ];
                if (differences.length) {
                    const written = actual.trace && expected.run?.traceSha256 !== actual.summary?.traceSha256 ? `\n    actual trace written to ${writeTrace(id, actual.trace)}` : '';
                    failures.push(`${id} differs from the 2.2 fixture:\n    ${differences.join('\n    ')}${written}`);
                }
            }
        }
        catch (error) {
            failures.push(`${subject.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    for (const id of recorded.keys())
        if (!seen.has(id) && !failures.some(f => f.startsWith(id)))
            failures.push(`${id}: recorded in the 2.2 fixture but not produced by the current run`);
    const uncovered = (await currentSubjects()).filter(s => s.tests ? !fixture.sources[s.model] : !recorded.has(s.id));
    const report = `Gate 2 (behaviour identity, ignoring ${IGNORED.join(' and ')}): ${seen.size} of ${recorded.size} recorded runs and cases rerun from ${subjects.size} subjects; ${failures.length} differences.`
        + (uncovered.length ? ` Not in the 2.2 fixture (not compared): ${uncovered.map(s => s.id).join(', ')}.` : '')
        + ` Recorded with ${fixture.recordedWith.implementation} at ${fixture.recordedWith.commit}.`;
    return { report, failures };
}

// ---------------------------------------------------------------- coverage of the 2.2 grammar by the gate subjects

/**
 * Which parts of the kept 2.2 grammar the models that gate 2 executes contain: every parser rule, every
 * alternative branch, every optional or repeated element of a rule and every keyword. A part is present
 * when some CST node of an executed model was produced by it. Presence is syntactic; it does not prove
 * that a run reaches the construct. Parts absent from every executed model are listed with the corpus
 * files (gate 1) that contain them.
 */
export async function coverage() {
    const { CstUtils, GrammarAST } = await import('langium');
    const { kept } = await parsers();
    const grammar = kept.Grammar, label = new Map(), parts = [];
    const text = element => element.$cstNode?.text.replace(/\s+/g, ' ') ?? element.$type;
    const add = (element, kind, name) => { label.set(element, `${kind} ${name}`); parts.push(element); };
    for (const rule of grammar.rules.filter(GrammarAST.isParserRule)) {
        add(rule, 'rule', rule.name);
        for (const element of [...(function* walk(e) { yield e; for (const c of e.elements ?? (e.terminal ? [e.terminal] : [])) yield* walk(c); })(rule.definition)]) {
            if (GrammarAST.isAlternatives(element))
                element.elements.forEach((branch, i) => add(branch, 'alternative', `${rule.name} #${i + 1}: ${text(branch)}`));
            if (element.cardinality && element !== rule.definition)
                add(element, 'optional', `${rule.name}: ${text(element)}`);
            else if (element.cardinality)
                add(element, 'optional', `${rule.name}: (${text(element)})`);
        }
    }
    const keywords = [...new Set(grammar.rules.flatMap(r => [...(function* walk(e) { if (GrammarAST.isKeyword(e)) yield e.value; for (const c of e?.elements ?? (e?.terminal ? [e.terminal] : [])) yield* walk(c); })(r.definition)]))].filter(k => /^[A-Za-z]/.test(k)).sort();
    const presence = files => {
        const seen = new Set(), words = new Set();
        for (const path of files) {
            const result = kept.parser.LangiumParser.parse(read(path));
            for (const node of CstUtils.streamCst(result.value.$cstNode)) {
                if (node.grammarSource && GrammarAST.isKeyword(node.grammarSource))
                    words.add(node.grammarSource.value);
                if (node.astNode?.$type)
                    for (const rule of grammar.rules) if (rule.name === node.astNode.$type || GrammarAST.isParserRule(rule) && rule.inferredType?.name === node.astNode.$type) seen.add(rule);
                for (let e = node.grammarSource; e && !GrammarAST.isGrammar(e); e = e.$container)
                    seen.add(e);
            }
        }
        return { seen, words };
    };
    const executed = Object.keys(JSON.parse(readFileSync(fixturePath('behaviour.json'), 'utf8')).sources)
        .concat(existsSync(fixturePath('behaviour-supplement.json')) ? Object.keys(JSON.parse(readFileSync(fixturePath('behaviour-supplement.json'), 'utf8')).sources) : []);
    const run = presence([...new Set(executed)].filter(p => existsSync(join(root, ...p.split('/')))));
    const corpusFiles = corpus().filter(p => !kept.parser.LangiumParser.parse(read(p)).parserErrors.length);
    const perFile = new Map(corpusFiles.map(p => [p, presence([p])]));
    const where = (test) => corpusFiles.filter(p => test(perFile.get(p))).map(p => p.replace(/^examples\//, ''));
    const missing = [
        ...parts.filter(e => !run.seen.has(e)).map(e => ({ part: label.get(e), corpus: where(f => f.seen.has(e)) })),
        ...keywords.filter(k => !run.words.has(k)).map(k => ({ part: `keyword ${k}`, corpus: where(f => f.words.has(k)) })),
    ];
    return { executedModels: [...new Set(executed)].length, parts: parts.length + keywords.length, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'coverage') {
    const { executedModels, parts, missing } = await coverage();
    console.log(`2.2 grammar parts absent from all ${executedModels} models that gate 2 executes: ${missing.length} of ${parts}.`);
    for (const m of missing)
        console.log(`  ${m.part}${m.corpus.length ? `  (in the gate-1 corpus: ${m.corpus.slice(0, 4).join(', ')}${m.corpus.length > 4 ? ', ...' : ''})` : '  (not in the gate-1 corpus)'}`);
}
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [gate, ...flags] = process.argv.slice(2), record = flags.includes('--record');
    const traces = flags.includes('--write-traces') ? resolve(flags[flags.indexOf('--write-traces') + 1] ?? '') : undefined;
    if (gate !== 'ast' && gate !== 'runs')
        throw Error('Usage: node scripts/compatibility-2-2.mjs ast|runs [--record | --write-traces <dir>]');
    if (record) {
        // Each fixture file is recorded once, with the 3.1.0 implementation; a gate never passes by re-recording.
        // The second file of each gate (resolution.json, behaviour-supplement.json) was added later from the same commit.
        const version = JSON.parse(read('package.json')).version;
        const [first, second] = gate === 'ast' ? ['ast.json', 'resolution.json'] : ['behaviour.json', 'behaviour-supplement.json'];
        const next = [first, second].find(f => !existsSync(fixturePath(f)));
        if (!next || version !== '3.1.0')
            throw Error(`The 2.2 compatibility fixtures are recorded once with implementation 3.1.0 (this is ${version}); they are never re-recorded.`);
        console.log(next === 'ast.json' ? await recordAst() : next === 'resolution.json' ? await recordResolution() : next === 'behaviour.json' ? await recordRuns() : await recordRunsSupplement());
    }
    else {
        const { report, failures } = gate === 'ast' ? await checkAst() : await checkRuns({ writeTraces: traces });
        for (const failure of failures)
            console.error(failure);
        console.log(report);
        if (failures.length)
            process.exitCode = 1;
    }
}
