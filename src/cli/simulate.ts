#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';
import type { Model } from '../language/generated/ast.js';
import { simulate, type SimulationOptions } from '../simulation/simulator.js';
import { languageArguments } from './options.js';

try {
    const [root, optionsFile, ...files] = languageArguments(process.argv.slice(2));
    if (!root || !optionsFile || !files.length) throw new Error('Usage: swaml-simulate [--language-version 1.2] Package::Root options.json file.swaml [more files...]');
    const options = JSON.parse(await readFile(optionsFile, 'utf8')) as SimulationOptions;
    const { shared } = createSwamlServices(NodeFileSystem);
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    for (const doc of docs) for (const d of doc.diagnostics ?? []) if (d.severity === 1) console.error(`${doc.uri.fsPath}:${d.range.start.line + 1} ${d.code ?? 'syntax'}: ${d.message}`);
    if (docs.some(d => d.diagnostics?.some(x => x.severity === 1))) process.exitCode = 1;
    else {
        const result = simulate(docs.map(d => d.parseResult.value as Model), root, options);
        const sourceDigests = result.sources.map(s => ({ uri: s.uri, sha256: createHash('sha256').update(s.text).digest('hex') }));
        console.log(JSON.stringify({ ...result, sourceDigests }, null, 2));
        process.exitCode = result.status === 'violation' || result.status === 'limit' || result.trace.some(t => t.kind === 'failure') ? 1 : 0;
    }
} catch (error) { console.error(String(error)); process.exitCode = 2; }
