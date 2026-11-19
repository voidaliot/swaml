/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmptyFileSystem, URI, type LangiumDocument } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { createSwamlServices } from '../language/swaml-module.js';
import { identity } from '../language/semantic.js';
import { RELEASE_GUARD_HINT, SwamlValueConverter } from '../language/swaml-syntax.js';
import { GRAMMAR_2_2 } from './grammar-2-2.js';
import { migrateSource, type MachineReport, type Identity, type Parse } from './machines.js';

/** The parser of the kept 2.2 grammar and the product identity, which migrateSource needs. */
export interface MigrationTools { parse: Parse; identity: Identity; }
let tools: Promise<MigrationTools> | undefined;
/** Builds (once per process) the parser of the kept 2.2 grammar, the grammar 2.2 machines are read with. */
export function migrationTools(): Promise<MigrationTools> {
    tools ??= (async () => {
        const kept = await createServicesForGrammar({ grammar: GRAMMAR_2_2, module: { parser: { ValueConverter: () => new SwamlValueConverter() } } } as any);
        return { parse: (text: string) => (kept as any).parser.LangiumParser.parse(text), identity };
    })();
    return tools;
}

/** One replaced range of a source: [start, end) offsets of the original text and the text written there. */
export interface MigrationEdit { start: number; end: number; text: string; }
/** Why a file is left unchanged, with the 1-based position it concerns. */
export interface MigrationRefusal { line: number; column: number; reason: string; }
/** The migration of one file. text is the new text when something changes and nothing is refused. */
export interface FileMigration {
    text?: string;
    edits: MigrationEdit[];
    machines: MachineReport[];
    /** Release guards spelled when (g) (the unreleased 3.0 candidate's spelling) rewritten to if (g), by 1-based line. */
    guards: { line: number; column: number }[];
    refused: MigrationRefusal[];
    /** New statement identity -> 2.2 statement identity, for old traces and overlays. */
    map: Record<string, string>;
}

const current = (() => { let s: ReturnType<typeof createSwamlServices>['Swaml'] | undefined; return () => (s ??= createSwamlServices(EmptyFileSystem).Swaml); })();
const position = (text: string, offset: number) => { const before = text.slice(0, offset), line = before.split('\n').length; return { line, column: offset - before.lastIndexOf('\n') }; };

/**
 * Release guards written when (g) after the call of a schedule entry, which the current grammar reports with the release
 * guard hint, rewritten to if (g). Returns the edits (in source order) and the text after them.
 */
export function migrateReleaseGuards(source: string): { text: string; edits: MigrationEdit[] } {
    const starts: number[] = [];
    let text = source;
    // Each pass fixes every guard the parser reports; recovery may hide a later one behind an earlier error, so repeat.
    for (let pass = 0; pass < 64; pass++) {
        const errors = current().parser.LangiumParser.parse(text).parserErrors as any[];
        const found = [...new Set(errors.filter(e => e.token?.image === 'when' && String(e.message).endsWith(RELEASE_GUARD_HINT)).map(e => e.token.startOffset as number))]
            .filter(o => text.slice(o, o + 4) === 'when').sort((a, b) => a - b);
        if (!found.length)
            break;
        // Offsets in the original text: every earlier rewrite before an offset shortened the text by two characters.
        const sorted = starts.slice().sort((a, b) => a - b);
        for (const c of found) {
            let o = c;
            for (const s of sorted)
                if (s < o)
                    o += 2;
            starts.push(o);
        }
        for (const offset of found.reverse())
            text = text.slice(0, offset) + 'if' + text.slice(offset + 4);
    }
    return { text, edits: starts.sort((a, b) => a - b).map(start => ({ start, end: start + 4, text: 'if' })) };
}

/**
 * Migrates one file: release guards written when (g) become if (g); 2.2 state machines become states in the flow (read
 * with the kept 2.2 grammar). A source that parses with the current grammar after the guard rewrite needs nothing else. A
 * source that parses with neither is refused at its first syntax error; a machine that cannot be migrated is refused at
 * its initial keyword, and the file is left unchanged as a whole.
 */
export async function migrateFile(source: string): Promise<FileMigration> {
    const guards = migrateReleaseGuards(source);
    const parsed = current().parser.LangiumParser.parse(guards.text);
    const guardLines = guards.edits.map(e => position(source, e.start));
    if (!parsed.lexerErrors.length && !parsed.parserErrors.length)
        return { text: guards.edits.length ? guards.text : undefined, edits: guards.edits, machines: [], guards: guardLines, refused: [], map: {} };
    const { parse, identity: id } = await migrationTools();
    const old = parse(source);
    if (old.lexerErrors.length || old.parserErrors.length) {
        // Neither grammar reads it: report the current grammar's first error, where the user has to look.
        const first = (parsed.lexerErrors[0] ?? parsed.parserErrors[0]) as any;
        const offset = first.offset ?? first.token?.startOffset ?? 0, at = position(guards.text, Number.isFinite(offset) ? offset : 0);
        return { edits: [], machines: [], guards: [], map: {}, refused: [{ ...at, reason: `syntax error that is not 2.2 state-machine syntax: ${String(first.message).split('\n')[0]}` }] };
    }
    const r = migrateSource(source, parse, id);
    if (!r.machines.length)
        return { edits: [], machines: [], guards: [], map: {}, refused: [{ line: 1, column: 1, reason: 'the source parses only as swa.ml 2.2, but contains no state machine to migrate; check it with swaml' }] };
    const refused = r.machines.flatMap(m => m.refused.map(reason => ({ line: m.line ?? 1, column: m.column ?? 1, reason: `${m.operation}: ${reason}` })));
    if (refused.length)
        return { edits: [], machines: r.machines, guards: [], map: {}, refused };
    return { text: r.text, edits: r.edits ?? [], machines: r.machines, guards: [], refused: [], map: r.map };
}

/**
 * Validates the migrated files as one workspace with the current language, beside the files given unchanged; returns the
 * errors of each file (an empty list when it validates), as "line:column code message".
 */
export async function validateMigrated(texts: Map<string, string>): Promise<Map<string, string[]>> {
    const { shared, Swaml } = createSwamlServices(EmptyFileSystem);
    const documents: LangiumDocument[] = [...texts].map(([file, text], i) => Swaml.shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse(`file:///migrated/${i}/${encodeURIComponent(file)}`)));
    for (const d of documents)
        shared.workspace.LangiumDocuments.addDocument(d);
    await shared.workspace.DocumentBuilder.build(documents, { validation: true });
    return new Map([...texts.keys()].map((file, i) => [file, (documents[i].diagnostics ?? []).filter(d => d.severity === 1).map(d => `${d.range.start.line + 1}:${d.range.start.character + 1} ${d.code ?? ''} ${d.message}`)]));
}
