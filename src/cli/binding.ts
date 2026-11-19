import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSwamlServices } from '../language/swaml-module.js';
import type { Model } from '../language/generated/ast.js';
import { BINDING_SCHEMA, bindingFindingText, checkBinding, type BindingFinding } from '../language/binding.js';
import { languageArguments } from './options.js';
export const BINDING_USAGE = 'swaml binding check [--language-version 3.0] [--json] binding.json file.swaml [more files...]';
/**
 * swaml binding check (WP8-M03, WP8-D10): validates a target binding against swaml-binding/1 and resolves its
 * identities against the validated sources and the named deployment. Prints one line per finding (severity, JSON
 * Pointer, identity, reason) and a summary, or JSON with --json. Exit codes: 0 when the binding resolves (placed
 * operations without a cost are findings and do not fail), 1 on a schema error, an unresolved or duplicate identity,
 * bcetNs > wcetNs, a binding file that is not JSON or sources with errors, 2 on a usage error or a file that
 * cannot be read. It computes no schedule.
 */
export async function bindingCommand(args: string[]): Promise<number> {
    if (args[0] !== 'check') {
        console.error(`Usage: ${BINDING_USAGE}`);
        return 2;
    }
    const json = args.includes('--json');
    const [bindingFile, ...files] = languageArguments(args.slice(1).filter(a => a !== '--json'));
    if (!bindingFile || !files.length) {
        console.error(`Usage: ${BINDING_USAGE}`);
        return 2;
    }
    let text: string;
    try {
        text = await readFile(resolve(bindingFile), 'utf8');
        for (const f of files)
            await readFile(resolve(f), 'utf8');
    }
    catch (error) {
        console.error(`Cannot read ${(error as { path?: string }).path ?? bindingFile}: ${(error as { code?: string }).code ?? String(error)}.`);
        return 2;
    }
    const { shared } = createSwamlServices(NodeFileSystem);
    const docs = await Promise.all(files.map(f => shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolve(f)))));
    await shared.workspace.DocumentBuilder.build(docs, { validation: true });
    const modelErrors = docs.flatMap(doc => (doc.diagnostics ?? []).filter(d => d.severity === 1).map(d => `${doc.uri.fsPath}:${d.range.start.line + 1}:${d.range.start.character + 1} error ${d.code ?? 'SW2000'}: ${d.message}`));
    let findings: BindingFinding[], deployment: string | undefined;
    if (modelErrors.length) {
        // The identities resolve only against a validated model.
        findings = [];
        deployment = undefined;
    }
    else {
        let value: unknown;
        try {
            value = JSON.parse(text.replace(/^﻿/u, ''));
        }
        catch (error) {
            value = undefined;
            findings = [{ severity: 'error', pointer: '', reason: `the file is not JSON (${(error as Error).message})` }];
        }
        if (value !== undefined) {
            const result = checkBinding(value, docs.map(d => d.parseResult.value as Model));
            findings = result.findings;
            deployment = result.deployment;
        }
    }
    const errors = findings!.filter(f => f.severity === 'error').length + modelErrors.length, notes = findings!.filter(f => f.severity === 'finding').length;
    if (json)
        console.log(JSON.stringify({ schema: BINDING_SCHEMA, binding: bindingFile, deployment: deployment ?? null, errorCount: errors, findingCount: notes, modelErrors, findings: findings! }, null, 2));
    else {
        for (const line of modelErrors)
            console.log(line);
        if (modelErrors.length)
            console.log('The sources have errors; the binding is checked only against a validated model.');
        for (const f of findings!)
            console.log(bindingFindingText(f));
        console.log(`Checked binding ${bindingFile}${deployment ? ` for ${deployment}` : ''} (${BINDING_SCHEMA}): ${errors} error(s), ${notes} finding(s).`);
    }
    return errors ? 1 : 0;
}
