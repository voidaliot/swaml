import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';
import type { Model } from '../language/generated/ast.js';
import { simulate, type SimulationOptions } from '../simulation/simulator.js';
import { implementationIdentity } from './evidence.js';
/**
 * Validates the supplied sources and runs one target. Without a target, the run selects the package
 * when the sources declare exactly one. Prints the result JSON and returns the process exit code.
 */
export async function runFiles(files: string[], target: string | undefined, options: SimulationOptions): Promise<number> {
    const { shared } = createSwamlServices(NodeFileSystem);
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    for (const doc of docs)
        for (const d of doc.diagnostics ?? [])
            if (d.severity === 1)
                console.error(`${doc.uri.fsPath}:${d.range.start.line + 1} ${d.code ?? 'syntax'}: ${d.message}`);
    if (docs.some(d => d.diagnostics?.some(x => x.severity === 1)))
        return 1;
    const models = docs.map(d => d.parseResult.value as Model);
    if (!target) {
        const packages = models.flatMap(m => m.packages);
        if (packages.length !== 1)
            throw new Error(`Select a run target with --target Package or --target Package::component; the sources declare ${packages.length} packages.`);
        target = packages[0].name;
    }
    const result = simulate(models, target, options);
    const sourceDigests = result.sources.map(s => ({ uri: s.uri, sha256: createHash('sha256').update(s.text).digest('hex') }));
    console.log(JSON.stringify({ ...result, implementation: await implementationIdentity(), sourceDigests }, null, 2));
    return result.status === 'violation' || result.status === 'limit' || result.outcome === 'failure-observed' ? 1 : 0;
}
/** Reads the options of swaml simulate: --target, and --options file.json or --until-ns N. */
export async function simulateCommand(args: string[]): Promise<number> {
    const files: string[] = [];
    let target: string | undefined, optionsFile: string | undefined, untilNs: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i], [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
        const value = () => { const v = inline ?? args[++i]; if (v === undefined || v === '') throw new Error(`${flag} needs a value`); return v; };
        if (flag === '--target') {
            if (target !== undefined)
                throw new Error('--target may be specified only once');
            target = value();
        }
        else if (flag === '--options') {
            if (optionsFile !== undefined)
                throw new Error('--options may be specified only once');
            optionsFile = value();
        }
        else if (flag === '--until-ns') {
            if (untilNs !== undefined)
                throw new Error('--until-ns may be specified only once');
            untilNs = value();
        }
        else if (arg.startsWith('-'))
            throw new Error(`Unknown option ${arg}`);
        else
            files.push(arg);
    }
    if (!files.length || !optionsFile === (untilNs === undefined))
        throw new Error('Usage: swaml simulate [--language-version 2.0] [--target Package|Package::component] (--options options.json | --until-ns N) file.swaml [more files...]');
    const options: SimulationOptions = optionsFile ? JSON.parse(await readFile(optionsFile, 'utf8')) : { untilNs: Number(untilNs) };
    return runFiles(files, target, options);
}
