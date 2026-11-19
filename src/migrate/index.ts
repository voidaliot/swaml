/**
 * The migration of swa.ml 2.2 sources to 3.0, as a package export (`@swaml/language/migrate`): migrateSource rewrites the
 * 2.2 state machines of one source with a given 2.2 parser, migrateFile does the whole migration of one file as
 * `swaml migrate` does (release guards, machines, refusals with locations), migrationTools builds the kept 2.2 parser,
 * migrateReleaseGuards rewrites when (g) release guards, and validateMigrated validates migrated texts as one workspace.
 */
export { migrateSource, type MachineReport, type MigrationResult, type Parse, type Identity } from './machines.js';
export { migrateFile, migrateReleaseGuards, migrationTools, validateMigrated, type FileMigration, type MigrationEdit, type MigrationRefusal, type MigrationTools } from './tools.js';
