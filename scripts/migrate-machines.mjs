// The migration of 2.2 state machines, for the repository's gates and tests: re-exports the package's migrator
// (src/migrate/machines.ts and src/migrate/tools.ts, built into out/), which the user command `swaml migrate` runs.
//
//   node scripts/migrate-machines.mjs <file|dir> … [--write]    the same as `swaml migrate` (needs a build)
import { pathToFileURL } from 'node:url';

const out = new URL('../out/src/migrate/', import.meta.url);
const machines = await import(new URL('machines.js', out).href);
const tools = await import(new URL('tools.js', out).href);
/** Migrates every 2.2 machine of one source; see src/migrate/machines.ts. */
export const migrateSource = machines.migrateSource;
/** The parser of the kept 2.2 grammar and the product identity. */
export const migrationTools = () => tools.migrationTools();
/** Validates migrated texts as one workspace with the current language. */
export const validateMigrated = texts => tools.validateMigrated(texts);
export const migrateFile = source => tools.migrateFile(source);
export const migrateReleaseGuards = source => tools.migrateReleaseGuards(source);

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const { migrateCommand } = await import(new URL('../out/src/cli/migrate.js', import.meta.url).href);
    process.exitCode = await migrateCommand(process.argv.slice(2));
}
