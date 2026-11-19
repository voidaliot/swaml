#!/usr/bin/env node
import type {Diagnostic} from 'vscode-languageserver';
import {createHash} from 'node:crypto';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';
import { formatDocument, FormattingSafetyError } from '../language/formatter.js';
import { LANGUAGE_VERSION, languageArguments, withoutLanguageVersion } from './options.js';
import { simulateCommand, testCommand, TEST_USAGE } from './run.js';
import { bindingCommand, BINDING_USAGE } from './binding.js';
import { migrateCommand, MIGRATE_USAGE } from './migrate.js';
try {
    const args = process.argv.slice(2);
    if (args[0] === 'simulate') {
        process.exitCode = await simulateCommand(withoutLanguageVersion(args.slice(1)));
    }
    else if (args[0] === 'test') {
        process.exitCode = await testCommand(withoutLanguageVersion(args.slice(1)));
    }
    else if (args[0] === 'binding') {
        process.exitCode = await bindingCommand(args.slice(1));
    }
    else if (args[0] === 'migrate') {
        process.exitCode = await migrateCommand(args.slice(1));
    }
    else {
    const json = args.includes('--json'), format = args.includes('--format'), checkFormat = args.includes('--check-format');
    const files = languageArguments(args.filter(a => !['--json', '--format', '--check-format'].includes(a)));
    if (!files.length || format && checkFormat)
        throw new Error('Usage: swaml [--language-version 2.3] [--json] [--format|--check-format] file.swaml [more files...]\n       swaml simulate [--language-version 2.3] [--target Package|Package::component] (--options options.json | --until-ns N) file.swaml [more files...]\n       ' + TEST_USAGE.replace('Usage: ', '') + '\n       ' + BINDING_USAGE + '\n       ' + MIGRATE_USAGE);
    const { shared, Swaml } = createSwamlServices(NodeFileSystem);
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    const diagnostics: (Diagnostic & {uri:string})[] = docs.flatMap(doc => (doc.diagnostics ?? []).map(d => ({ ...d, code: d.code ?? 'SW2000', uri: doc.uri.toString(),data:{...d.data,declaration:d.data?.declaration??null,occurrencePaths:d.data?.occurrencePaths??[],documentVersion:doc.textDocument.version,sourceSha256:createHash('sha256').update(doc.textDocument.getText()).digest('hex')} })));
    let errors = diagnostics.filter(d => d.severity === 1).length;
    let internal = false;
    if (!errors && (format || checkFormat))
        for (const doc of docs) {
            let text: string;
            try {
                text = formatDocument(doc, Swaml.parser.Lexer);
            }
            catch (error) {
                if (!(error instanceof FormattingSafetyError))
                    throw error;
                // Never write text that would lose or change a token; report the defect instead.
                errors++;
                internal = true;
                diagnostics.push({ uri: doc.uri.toString(), code: 'internal-error', severity: 1, message: error.message, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } });
                continue;
            }
            if (text !== doc.textDocument.getText()) {
                if (format)
                    await writeFile(doc.uri.fsPath, text, 'utf8');
                else {
                    errors++;
                    diagnostics.push({ uri: doc.uri.toString(), code: 'SW2014', severity: 1, message: 'Source differs from canonical formatting.', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } });
                }
            }
        }
    if (json)
        console.log(JSON.stringify({ languageVersion: LANGUAGE_VERSION, errorCount: errors, diagnostics }, null, 2));
    else {
        for (const d of diagnostics)
            console.log(`${URI.parse(d.uri).fsPath}:${d.range.start.line + 1}:${d.range.start.character + 1} ${d.severity === 1 ? 'error' : 'warning'} ${d.code}: ${d.message}`);
        console.log(`Checked ${docs.length} model(s), swa.ml ${LANGUAGE_VERSION}: ${errors} error(s).`);
    }
    process.exitCode = internal ? 2 : errors ? 1 : 0;
    }
}
catch (error) {
    console.error(String(error));
    process.exitCode = 2;
}
