import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
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

/** The changed lines of one file, old then new, per edit, with 1-based line numbers of the old text. */
function diff(source: string, m: FileMigration): string[] {
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
        out.push(...linesOf(m.text!, newStart, newEnd).map(l => `+${l}`));
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
    const files: string[] = [];
    try {
        for (const p of paths)
            for (const f of await swamlFiles(resolve(p)))
                if (!files.includes(f))
                    files.push(f);
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
            for (const line of diff(sources.get(file)!, r))
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
    if (write && !failed)
        for (const file of migrated)
            await writeFile(file, results.get(file)!.text!, 'utf8');
    const nothing = files.length - migrated.length - [...results.values()].filter(r => r.refused.length).length;
    if (failed)
        console.log(`No file written: fix the reasons above (or the 2.2 source) and run swaml migrate again.`);
    else if (write)
        console.log(`Migrated ${migrated.length} file(s); ${nothing} file(s) had nothing to migrate.`);
    else
        console.log(`Dry run: ${migrated.length} file(s) would change, ${nothing} file(s) have nothing to migrate; nothing written (run again with --write).`);
    return failed ? 1 : 0;
}
