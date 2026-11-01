import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AstUtils, URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';
import type { Model } from '../language/generated/ast.js';
import { REFERENCE_PROFILE, runTests, simulate, type SimulationOptions } from '../simulation/simulator.js';
import { implementationIdentity } from './evidence.js';
import { LANGUAGE_VERSION } from './options.js';
/** The default horizon of swaml test: a case run stops earlier when its script completes or fails. */
export const DEFAULT_TEST_HORIZON_NS = 10000000000;
/** Loads, links and validates the supplied sources; prints errors and returns undefined when any exists. */
async function load(files: string[]): Promise<Model[] | undefined> {
    const { shared } = createSwamlServices(NodeFileSystem);
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    for (const doc of docs)
        for (const d of doc.diagnostics ?? [])
            if (d.severity === 1)
                console.error(`${doc.uri.fsPath}:${d.range.start.line + 1} ${d.code ?? 'syntax'}: ${d.message}`);
    if (docs.some(d => d.diagnostics?.some(x => x.severity === 1)))
        return undefined;
    return docs.map(d => d.parseResult.value as Model);
}
const digests = (sources: { uri: string; text: string }[]) => sources.map(s => ({ uri: s.uri, sha256: createHash('sha256').update(s.text).digest('hex') }));
/**
 * Validates the supplied sources and runs one target. Without a target, the run selects the package
 * when the sources declare exactly one. Prints the result JSON and returns the process exit code.
 */
export async function runFiles(files: string[], target: string | undefined, options: SimulationOptions): Promise<number> {
    const models = await load(files);
    if (!models)
        return 1;
    if (!target) {
        const packages = models.flatMap(m => m.packages);
        if (packages.length !== 1)
            throw new Error(`Select a run target with --target Package or --target Package::component; the sources declare ${packages.length} packages.`);
        target = packages[0].name;
    }
    const result = simulate(models, target, options);
    console.log(JSON.stringify({ ...result, implementation: await implementationIdentity(), sourceDigests: digests(result.sources) }, null, 2));
    return result.status === 'violation' || result.status === 'limit' || result.outcome === 'failure-observed' ? 1 : 0;
}
type Flags = { files: string[]; values: Map<string, string>; switches: Set<string> };
/** Reads repeated-once value flags (--name value or --name=value), switches and positional files. */
function flags(args: string[], valued: string[], switches: string[] = []): Flags {
    const result: Flags = { files: [], values: new Map(), switches: new Set() };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i], [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
        if (valued.includes(flag)) {
            if (result.values.has(flag))
                throw new Error(`${flag} may be specified only once`);
            const v = inline ?? args[++i];
            if (v === undefined || v === '')
                throw new Error(`${flag} needs a value`);
            result.values.set(flag, v);
        }
        else if (switches.includes(arg))
            result.switches.add(arg);
        else if (arg.startsWith('-'))
            throw new Error(`Unknown option ${arg}`);
        else
            result.files.push(arg);
    }
    return result;
}
/** Reads --options file.json or --until-ns N; at most one of them. */
async function runOptions(f: Flags, fallback?: SimulationOptions): Promise<SimulationOptions | undefined> {
    const file = f.values.get('--options'), until = f.values.get('--until-ns');
    if (file !== undefined && until !== undefined)
        return undefined;
    return file ? JSON.parse(await readFile(file, 'utf8')) : until !== undefined ? { untilNs: Number(until) } : fallback;
}
/** Reads the options of swaml simulate: --target, and --options file.json or --until-ns N. */
export async function simulateCommand(args: string[]): Promise<number> {
    const f = flags(args, ['--target', '--options', '--until-ns']), options = await runOptions(f);
    if (!f.files.length || !options)
        throw new Error('Usage: swaml simulate [--language-version 2.0] [--target Package|Package::component] (--options options.json | --until-ns N) file.swaml [more files...]');
    return runFiles(f.files, f.values.get('--target'), options);
}
export const TEST_USAGE = 'Usage: swaml test [--language-version 2.0] [--package P] [--case Package::Case|Case] [--json] [--options options.json | --until-ns N] file.swaml [more files...]';
/**
 * Runs the use cases and tests of the supplied sources: swaml test. Prints a summary, or JSON
 * with --json, and returns 1 when a case fails or the sources are invalid, otherwise 0.
 */
export async function testCommand(args: string[]): Promise<number> {
    const f = flags(args, ['--package', '--case', '--options', '--until-ns'], ['--json']), options = await runOptions(f, { untilNs: DEFAULT_TEST_HORIZON_NS });
    if (!f.files.length || !options)
        throw new Error(TEST_USAGE);
    const models = await load(f.files);
    if (!models)
        return 1;
    const results = runTests(models, options, { package: f.values.get('--package'), case: f.values.get('--case') });
    if ((f.values.has('--package') || f.values.has('--case')) && !results.length)
        throw new Error(`No use case or test matches${f.values.has('--package') ? ' package ' + f.values.get('--package') : ''}${f.values.has('--case') ? ' case ' + f.values.get('--case') : ''}.`);
    const summary = { pass: 0, fail: 0, inconclusive: 0, noChecks: 0 };
    for (const r of results)
        summary[r.result === 'no checks' ? 'noChecks' : r.result]++;
    if (f.switches.has('--json')) {
        // The report states the supplied sources once as digests, also when no case ran.
        const sources = models.map(m => AstUtils.getDocument(m)).map(d => ({ uri: d.uri.toString(), text: d.textDocument.getText() }));
        const cases = results.map(r => r.run ? { ...r, run: { ...r.run, sources: undefined } } : r);
        console.log(JSON.stringify({ languageVersion: LANGUAGE_VERSION, profile: REFERENCE_PROFILE, options, summary, cases, implementation: await implementationIdentity(), sourceDigests: digests(sources) }, null, 2));
    }
    else {
        for (const r of results) {
            const where = r.source ? ` at ${r.source}` : '';
            console.log(`${r.result.padEnd(12)} ${r.case}${r.result === 'fail' || r.result === 'inconclusive' ? `${where}: ${r.message}` : ''}`);
        }
        console.log(`${results.length} case(s): ${summary.pass} pass, ${summary.fail} fail, ${summary.inconclusive} inconclusive, ${summary.noChecks} no checks.`);
    }
    return summary.fail ? 1 : 0;
}
