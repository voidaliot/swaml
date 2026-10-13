#!/usr/bin/env node
import { resolve } from 'node:path';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';

const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: swaml <file.swaml> [more files...]'); process.exit(2); }
const { shared } = createSwamlServices(NodeFileSystem);
try {
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    let errors = 0;
    for (const doc of docs) {
        for (const d of doc.diagnostics ?? []) {
            console.log(`${doc.uri.fsPath}:${d.range.start.line + 1}:${d.range.start.character + 1} ${d.severity === 1 ? 'error' : 'warning'} ${d.code ?? 'syntax'}: ${d.message}`);
            if (d.severity === 1) errors++;
        }
    }
    console.log(`Checked ${docs.length} model(s): ${errors} error(s). This validates the implemented 0.1 checks; it is not execution or KerML conformance verification.`);
    process.exitCode = errors ? 1 : 0;
} catch (error) { console.error(String(error)); process.exitCode = 2; }
