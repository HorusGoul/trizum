/**
 * Migration module for SDK models.
 *
 * This module provides a framework for migrating documents between schema versions.
 * Migrations run automatically when documents are loaded via SDK hooks/cache.
 */

// Error types
export {
  VersionMismatchError,
  MigrationError,
  NoMigrationPathError,
} from "./errors.js";

// Registry
export {
  registerMigration,
  getMigration,
  getMigrationsForModel,
  getMigrationChain,
  hasMigrationPath,
  clearMigrations,
  getRegisteredModelTypes,
  type Migration,
  type MigrationFn,
} from "./registry.js";

// Runner
export {
  migrateDocument,
  migrateIfNeeded,
  setSchemaVersion,
  type MigrationResult,
  type MigrateDocumentOptions,
} from "./runner.js";
