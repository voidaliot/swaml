// States in the flow, compatibility gates B and C (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 7.4): every recorded run and
// case of a 2.2 source that contains a 2.2 state machine is run again after migration (scripts/migrate-machines.mjs, from
// the recorded 2.2 bytes, with the kept 2.2 grammar) and compared with the recorded 2.2 behaviour after mapping statement
// identities through the migrator's identity map. Gate A (2.2 sources without machines) stays gates 1 to 3 of
// scripts/compatibility-2-2.mjs and the extended sets of scripts/compatibility-2-2-extended.mjs.
//
//   node scripts/compatibility-machines.mjs           gate B: compares with test/fixtures/compatibility-2-2/machines.json
//   node scripts/compatibility-machines.mjs record    records machines.json, only from an implementation that still runs
//                                                     2.2 machines and whose raw traces equal the 3.1.0 recordings
//
// The baseline holds, per result, what gate B compares: the verdict, status, final stores, the current state of every
// machine, the per-kind observation counts and one order-sensitive digest per component of the normalized trace (stores
// and components as SHA-256 of canonical JSON). It is
// recorded from the 2.2 source, and every recorded raw trace must have the SHA-256 that the 3.1.0 fixture holds for it
// (behaviour.json, behaviour-supplement.json, recorded*.json of the extended sets): the baseline is 3.1.0's behaviour.
//
// Normalization (both sides, the documented differences of 7.4 only): ordinal, profile and languageVersion are left out
// (an observation's position is in the per-component order); range and uri of emitter and caller are left out (the text
// moved); the trigger of a state observation is left out (SIF-T01, new). On the migrated side, every statement identity
// (source) is mapped to its 2.2 identity through the identity map. The one accepted difference is r10 (gate C): input for
// two members queued while the machine is busy is served in delivery order; its final store is listed in the baseline.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, comparedTrace, execute, fixtureDirectory, loader, recordedSource, root, sha256, sourceSha256, subjectsOf } from './compatibility-2-2.mjs';
import { SETS } from './compatibility-2-2-extended.mjs';
import { migrateSource, migrationTools } from './migrate-machines.mjs';

const fixtureFile = join(root, ...fixtureDirectory.split('/'), 'machines.json');
const extendedDirectory = join(root, 'test', 'fixtures', 'compatibility-2-2-extended');
const EXTENDED_OPTIONS = { untilNs: 100000000 };
/**
 * Gate C: the one accepted difference, by result id, with the reason. Its final store and the order of its observations
 * (which serve the two members in another order) may differ; its verdict, status, machines and per-kind counts are compared.
 */
const ACCEPTED = { stores: { 'ext models-wp5.json r10 input for two members queued while the machine is busy: the queue created first is served first, the 2.2 queue walk (runs) run': 'r10: input for two members queued while the machine is busy is served in delivery order (2.2 served the queue created first)' } };

const normalized = (trace, map) => {
    const keys = map ? Object.keys(map).sort((x, y) => y.length - x.length) : [];
    const mapId = s => { if (typeof s !== 'string' || !map) return s; for (const k of keys) if (s === k || s.startsWith(k + '/')) return map[k] + s.slice(k.length); return s; };
    return comparedTrace(trace).map(({ ordinal: _o, trigger: _t, ...e }) => {
        for (const k of ['emitter', 'caller'])
            if (e[k] && typeof e[k] === 'object') {
                const { range: _r, uri: _u, ...rest } = e[k];
                e[k] = rest;
            }
        if (map)
            e.source = mapId(e.source);
        if (e.source === undefined)
            delete e.source;
        return e;
    });
};
/** What gate B compares of one result. */
function summary(result, map) {
    const run = result.run ?? result, trace = run.trace ? normalized(run.trace, map) : [], kinds = {}, per = {};
    for (const e of trace) {
        kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
        (per[String(e.subject ?? '').split('.')[0]] ??= []).push(canonicalJson(e));
    }
    const verdict = result.result !== undefined || result.threw !== undefined ? { result: result.result ?? null, reason: result.reason ?? null, message: result.message ?? null, threw: result.threw ?? null } : undefined;
    return { ...(verdict ? { verdict } : {}), status: run.status ?? null, stores: run.stores ? sha256(canonicalJson(run.stores)) : null,
        machines: Object.fromEntries(Object.entries(run.machines ?? {}).map(([k, v]) => [k, v.state]).sort()),
        kinds: Object.fromEntries(Object.entries(kinds).sort()), components: Object.fromEntries(Object.entries(per).sort().map(([c, l]) => [c, sha256(l.join('\n'))])) };
}

/** Every 2.2 source with a machine and the results recorded for it: corpus entries and extended models. */
async function subjects(parse) {
    const hasMachine = text => { const r = parse(text); return !r.parserErrors.length && !r.lexerErrors.length && containsMachine(r.value); };
    const fixturePath = name => join(root, ...fixtureDirectory.split('/'), name);
    const base = JSON.parse(readFileSync(fixturePath('behaviour.json'), 'utf8')), supplement = JSON.parse(readFileSync(fixturePath('behaviour-supplement.json'), 'utf8'));
    const sources = { ...base.sources, ...supplement.sources }, entries = [...base.entries, ...supplement.entries], out = [];
    for (const subject of subjectsOf(entries).values()) {
        const source = recordedSource(subject.model, sources[subject.model]);
        if (!source || !hasMachine(source.text))
            continue;
        const recorded = new Map(entries.filter(e => e.model === subject.model).map(e => [e.id, e.run?.traceSha256 ?? null]));
        out.push({ kind: 'corpus', subject, text: source.text, sha256: sources[subject.model], recorded });
    }
    for (const set of SETS) {
        const models = JSON.parse(readFileSync(join(extendedDirectory, set.models), 'utf8')).models, recordedSet = JSON.parse(readFileSync(join(extendedDirectory, set.recorded), 'utf8')).files;
        models.forEach((m, index) => {
            const recorded = recordedSet[m.name];
            if (!hasMachine(m.text) || !recorded || recorded.diagnostics.some(d => d.startsWith('error ')))
                return;
            out.push({ kind: 'extended', set: set.models, index, model: m, text: m.text, sha256: sourceSha256(m.text), recorded });
        });
    }
    return out;
}
function containsMachine(node) {
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$'))
            continue;
        for (const child of Array.isArray(value) ? value : [value])
            if (child && typeof child === 'object' && typeof child.$type === 'string' && (child.$type === 'OperationBody' && child.states?.length || containsMachine(child)))
                return true;
    }
    return false;
}

/** Runs one subject on a text; yields [id, result, raw trace digest]. */
async function* results(s, text, load) {
    if (s.kind === 'corpus') {
        for await (const [id, actual] of execute(s.subject, text, load))
            yield [id, { ...actual.fields, ...(actual.summary ? { run: { ...actual.summary, trace: actual.trace } } : {}) }, actual.summary?.traceSha256 ?? null];
        return;
    }
    const { simulate, runCase } = await import('../out/src/simulation/simulator.js');
    const { EmptyFileSystem } = await import('langium');
    const { parseHelper } = await import('langium/test');
    const { createSwamlServices } = await import('../out/src/language/swaml-module.js');
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper(Swaml)(text, { validation: true, documentUri: `file:///${s.index + 1}.swaml` });
    const errors = (document.diagnostics ?? []).filter(d => d.severity === 1);
    if (errors.length)
        throw Error(`ext ${s.set} ${s.model.name}: ${errors.map(e => e.message).join('; ')}`);
    const models = [document.parseResult.value], digest = trace => sha256(canonicalJson(comparedTrace(trace)));
    const attempt = f => { try { return f(); } catch (error) { return { threw: `${error?.constructor?.name}: ${error?.message}` }; } };
    if (s.model.target) {
        const r = attempt(() => simulate(models, s.model.target, EXTENDED_OPTIONS));
        yield [`ext ${s.set} ${s.model.name} run`, r, r.trace ? digest(r.trace) : null];
    }
    for (const t of s.model.tests ?? []) {
        const c = attempt(() => runCase(models, t, EXTENDED_OPTIONS));
        yield [`ext ${s.set} ${s.model.name} case ${t}`, c, c.run ? digest(c.run.trace) : null];
    }
}
const recordedDigest = (s, id) => s.kind === 'corpus' ? s.recorded.get(id) ?? null : id.endsWith(' run') ? s.recorded.run?.traceSha256 ?? null : s.recorded.cases?.[id.replace(/^.* case /u, '')]?.traceSha256 ?? null;

async function record() {
    const { parse, identity: _ } = await migrationTools(), load = await loader(), entries = {}, problems = [];
    for (const s of await subjects(parse))
        for await (const [id, result, raw] of results(s, s.text, load)) {
            if (raw !== recordedDigest(s, id))
                problems.push(`${id}: the raw trace differs from the 3.1.0 recording`);
            entries[id] = summary(result);
        }
    if (problems.length)
        throw Error(`Record gate B only from an implementation whose 2.2 machine runs equal 3.1.0:\n  ${problems.join('\n  ')}`);
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    if (git('status', '--porcelain', '--', 'src', 'libraries', 'langium-config.json', 'package-lock.json'))
        throw Error('Record gate B only from a committed implementation.');
    const fixture = { rule: 'SIF gates B and C (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 7.4)', recordedWith: { commit: git('rev-parse', 'HEAD'), node: process.version }, recordedFrom: 'the 2.2 sources of the gate-2 corpus and of the extended sets that contain a 2.2 machine; every raw trace equal to its 3.1.0 recording',
        normalization: 'ordinal, profile, languageVersion, trigger, emitter and caller range and uri left out; per-component digests are SHA-256 of the canonical observations joined by newlines', accepted: ACCEPTED, entries: '@' };
    writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2).replace('"entries": "@"', '"entries": {\n' + Object.entries(entries).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }') + '\n');
    return `Recorded gate B: ${Object.keys(entries).length} results of 2.2 machines, each equal to its 3.1.0 trace.`;
}

async function check() {
    const { parse, identity } = await migrationTools(), load = await loader(), fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
    const rows = { missing: [], refused: [], verdict: [], stores: [], status: [], machines: [], kinds: [], order: [] }, accepted = [], seen = new Set();
    let same = 0;
    for (const s of await subjects(parse)) {
        const migrated = migrateSource(s.text, parse, identity);
        if (migrated.text === undefined) {
            rows.refused.push(`${s.kind === 'corpus' ? s.subject.model : `${s.set} ${s.model.name}`}: ${migrated.refused.join('; ')}`);
            continue;
        }
        for await (const [id, result] of results(s, migrated.text, load)) {
            seen.add(id);
            const expected = fixture.entries[id], actual = summary(result, migrated.map);
            if (!expected) {
                rows.missing.push(`${id}: not in machines.json`);
                continue;
            }
            const differs = key => canonicalJson(expected[key]) !== canonicalJson(actual[key]);
            if (differs('verdict')) {
                rows.verdict.push(`${id}: ${canonicalJson(expected.verdict)} -> ${canonicalJson(actual.verdict)}`);
                continue;
            }
            if (differs('stores')) {
                if (ACCEPTED.stores[id])
                    accepted.push(id);
                else {
                    rows.stores.push(`${id}: ${canonicalJson((result.run ?? result).stores)}`);
                    continue;
                }
            }
            if (differs('status'))
                rows.status.push(`${id}: ${expected.status} -> ${actual.status}`);
            else if (differs('machines'))
                rows.machines.push(`${id}: ${canonicalJson(expected.machines)} -> ${canonicalJson(actual.machines)}`);
            else if (differs('kinds'))
                rows.kinds.push(`${id}: ${Object.keys({ ...expected.kinds, ...actual.kinds }).filter(k => expected.kinds[k] !== actual.kinds[k]).map(k => `${k} ${expected.kinds[k] ?? 0} -> ${actual.kinds[k] ?? 0}`).join(', ')}`);
            else if (differs('components') && !ACCEPTED.stores[id])
                rows.order.push(`${id}: components ${Object.keys({ ...expected.components, ...actual.components }).filter(c => expected.components[c] !== actual.components[c]).join(', ')}`);
            else if (!ACCEPTED.stores[id])
                same++;
        }
    }
    for (const id of Object.keys(fixture.entries))
        if (!seen.has(id))
            rows.missing.push(`${id}: recorded, not run`);
    const failures = Object.entries(rows).flatMap(([k, v]) => v.map(x => `${k}: ${x}`));
    const missingAccepted = Object.keys(ACCEPTED.stores).filter(id => !accepted.includes(id));
    failures.push(...missingAccepted.map(id => `accepted: ${id} no longer differs; remove it from ACCEPTED (gate C)`));
    return { failures, report: `Gate B (2.2 machines after migration): ${same} of ${Object.keys(fixture.entries).length} results identical after mapping identities, ${accepted.length} accepted difference of store and order (r10, gate C); ${failures.length} other differences.` };
}

if (process.argv[2] === 'record')
    console.log(await record());
else {
    const { failures, report } = await check();
    console.log(report);
    if (failures.length) {
        console.error(failures.join('\n'));
        process.exitCode = 1;
    }
}
