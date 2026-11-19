import { access, constants, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { migrateFile, validateMigrated, type FileMigration } from '../migrate/tools.js';
import { withoutLanguageVersion } from './options.js';

export const MIGRATE_USAGE = 'swaml migrate [--write] file.swaml|directory [more files or directories...]';
/** Directories a directory walk never enters. */
const SKIPPED = new Set(['node_modules', 'out', '.git']);

async function swamlFiles(path: string): Promise<string[]> {
    const info = await stat(path);
    if (!info.isDirectory())
        return [path];
    const out: string[] = [];
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
        if (entry.isDirectory() && !SKIPPED.has(entry.name) && !entry.name.startsWith('.'))
            out.push(...await swamlFiles(join(path, entry.name)));
        else if (entry.isFile() && entry.name.endsWith('.swaml'))
            out.push(join(path, entry.name));
    }
    return out;
}

/**
 * Writes every file or none (review m8): each target must be writable, each new text is written to a temporary file
 * beside it, then the temporary files replace the targets; a failure removes the temporary files and puts back the
 * targets already replaced. Returns undefined on success, else what failed.
 */
async function writeAll(files: [string, string, string][]): Promise<string | undefined> {
    const temporary = (file: string) => `${file}.swaml-migrate.tmp`;
    const written: string[] = [], replaced: [string, string][] = [];
    try {
        for (const [file] of files)
            await access(file, constants.W_OK);
        for (const [file, text] of files) {
            await writeFile(temporary(file), text, 'utf8');
            written.push(file);
        }
        for (const [file, , original] of files) {
            await rename(temporary(file), file);
            replaced.push([file, original]);
        }
        return undefined;
    }
    catch (error) {
        for (const file of written)
            if (!replaced.some(([f]) => f === file))
                await unlink(temporary(file)).catch(() => undefined);
        for (const [file, original] of replaced)
            await writeFile(file, original, 'utf8').catch(() => undefined);
        return `${(error as NodeJS.ErrnoException).code ?? 'error'} on ${(error as NodeJS.ErrnoException).path ?? 'a file'}: ${(error as Error).message}`;
    }
}

/** The changed lines of one file, old then new, per edit, with 1-based line numbers of the old text. */
function diff(m: FileMigration): string[] {
    const source = m.base!, text = m.baseText!;
    const out: string[] = [];
    let delta = 0;
    const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;
    const linesOf = (text: string, start: number, end: number) => {
        const from = text.lastIndexOf('\n', start - 1) + 1, to = text.indexOf('\n', end);
        return text.slice(from, to < 0 ? text.length : to).split('\n');
    };
    for (const e of m.edits) {
        const newStart = e.start + delta, newEnd = newStart + e.text.length;
        out.push(`@@ line ${lineOf(source, e.start)} @@`);
        out.push(...linesOf(source, e.start, e.end).map(l => `-${l}`));
        out.push(...linesOf(text, newStart, newEnd).map(l => `+${l}`));
        delta += e.text.length - (e.end - e.start);
    }
    return out;
}

/**
 * swaml migrate: rewrites 2.2 state machines as states in the flow and release guards written when (g) as if (g), for the
 * given files and every .swaml file below the given directories. A dry run by default: it prints what would change (a
 * summary per machine and the changed lines) and writes nothing; --write writes the files. Every migrated file is
 * validated with the current language as one workspace with the other files given; a file that is refused (with the
 * reason and its line:column) or does not validate is reported, and then nothing is written at all. Exit codes: 0 when
 * every file migrates or has nothing to migrate, 1 on a refusal or a migrated file with errors, 2 on a usage error or a
 * file that cannot be read.
 */
export async function migrateCommand(args: string[]): Promise<number> {
    let paths: string[], write = false;
    try {
        paths = withoutLanguageVersion(args).filter(a => {
            if (a === '--write')
                return !(write = true);
            if (a.startsWith('-'))
                throw new Error(`Unknown option ${a}`);
            return true;
        });
    }
    catch (error) {
        console.error(`${String(error)}\nUsage: ${MIGRATE_USAGE}`);
        return 2;
    }
    if (!paths.length) {
        console.error(`Usage: ${MIGRATE_USAGE}`);
        return 2;
    }
    const files: string[] = [], seen = new Set<string>();
    try {
        for (const p of paths)
            for (const f of await swamlFiles(resolve(p))) {
                // One file named in two spellings (case on Windows, links) is migrated once (review m10).
                const real = realpathSync.native(f);
                if (!seen.has(real)) {
                    seen.add(real);
                    files.push(f);
                }
            }
    }
    catch (error) {
        console.error(String(error));
        return 2;
    }
    const sources = new Map<string, string>(), results = new Map<string, FileMigration>();
    for (const file of files) {
        try {
            sources.set(file, await readFile(file, 'utf8'));
        }
        catch (error) {
            console.error(String(error));
            return 2;
        }
        results.set(file, await migrateFile(sources.get(file)!));
    }
    const shown = (file: string) => relative(process.cwd(), file) || file;
    let failed = false;
    const migrated = [...results].filter(([, r]) => r.text !== undefined).map(([f]) => f);
    for (const [file, r] of results) {
        if (r.refused.length) {
            failed = true;
            for (const x of r.refused)
                console.log(`${shown(file)}:${x.line}:${x.column} refused: ${x.reason}`);
            continue;
        }
        if (r.text === undefined)
            continue;
        const parts = [r.machines.length ? `${r.machines.length} state machine(s)` : '', r.guards.length ? `${r.guards.length} release guard(s) when -> if` : ''].filter(x => x);
        console.log(`${shown(file)}: ${parts.join(' and ')}`);
        for (const m of r.machines) {
            console.log(`  ${m.line}:${m.column} ${m.operation}: ${m.states} state(s)`);
            for (const [label, list] of [['removed transitions (never taken in 2.2)', m.removedTransitions], ['removed timers (never taken in 2.2)', m.removedTimers], ['renamed bindings', m.renamedBindings], ['exit actions copied into leaving blocks', m.copiedExits], ['notes', m.notes]] as const)
                if (list.length)
                    console.log(`    ${label}: ${list.join('; ')}`);
        }
        for (const g of r.guards)
            console.log(`  ${g.line}:${g.column} release guard when (…) -> if (…)`);
        if (!write)
            for (const line of diff(r))
                console.log(`    ${line}`);
    }
    // Nothing is written unless every migrated file validates as part of the workspace given.
    if (migrated.length) {
        const texts = new Map(files.map(f => [f, results.get(f)!.text ?? sources.get(f)!]));
        const errors = await validateMigrated(texts);
        for (const file of migrated)
            if (errors.get(file)!.length) {
                failed = true;
                console.log(`${shown(file)}: the migrated text does not validate, nothing written\n  ${errors.get(file)!.join('\n  ')}`);
            }
    }
    if (write && !failed) {
        const problem = await writeAll(migrated.map(file => [file, results.get(file)!.text!, sources.get(file)!]));
        if (problem) {
            console.log(`No file written: ${problem}`);
            return 2;
        }
    }
    const nothing = files.length - migrated.length - [...results.values()].filter(r => r.refused.length).length;
    if (failed)
        console.log(`No file written: fix the reasons above (or the 2.2 source) and run swaml migrate again.`);
    else if (write)
        console.log(`Migrated ${migrated.length} file(s); ${nothing} file(s) had nothing to migrate.`);
    else
        console.log(`Dry run: ${migrated.length} file(s) would change, ${nothing} file(s) have nothing to migrate; nothing written (run again with --write).`);
    return failed ? 1 : 0;
}
