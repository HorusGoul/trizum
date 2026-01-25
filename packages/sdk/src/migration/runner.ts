/**
 * Migration runner for applying migrations to documents.
 */

import type { VersionedModel } from "../models/versioned.js";
import {
  SDK_SCHEMA_VERSION,
  needsMigration,
  isFromNewerSdk,
} from "../models/versioned.js";
import { VersionMismatchError, MigrationError } from "./errors.js";
import { getMigrationChain } from "./registry.js";

/**
 * Result of a migration operation.
 */
export interface MigrationResult<T> {
  /** The migrated document */
  doc: T;
  /** Whether any migrations were applied */
  migrated: boolean;
  /** The original version before migration */
  originalVersion: number;
  /** The final version after migration */
  finalVersion: number;
  /** Number of migrations applied */
  migrationsApplied: number;
}

/**
 * Options for the migration runner.
 */
export interface MigrateDocumentOptions {
  /**
   * Target version to migrate to.
   * Defaults to SDK_SCHEMA_VERSION.
   */
  targetVersion?: number;

  /**
   * If true, throw an error when the document is from a newer SDK.
   * Defaults to true.
   */
  throwOnNewerVersion?: boolean;
}

/**
 * Migrate a document to a target schema version.
 *
 * This function:
 * 1. Checks if the document needs migration
 * 2. Throws VersionMismatchError if the document is from a newer SDK
 * 3. Applies all necessary migrations in sequence
 * 4. Returns the migrated document
 *
 * @param doc - The document to migrate
 * @param modelType - The model type (e.g., "party", "expense")
 * @param options - Migration options
 * @returns The migration result
 * @throws VersionMismatchError if document version > SDK version
 * @throws MigrationError if a migration fails
 * @throws NoMigrationPathError if no migration path exists
 */
export function migrateDocument<T extends Partial<VersionedModel>>(
  doc: T,
  modelType: string,
  options: MigrateDocumentOptions = {},
): MigrationResult<T> {
  const { targetVersion = SDK_SCHEMA_VERSION, throwOnNewerVersion = true } =
    options;

  const originalVersion = doc.__schemaVersion ?? 0;

  // Check for newer version
  if (throwOnNewerVersion && isFromNewerSdk(doc)) {
    throw new VersionMismatchError(originalVersion, SDK_SCHEMA_VERSION);
  }

  // No migration needed
  if (!needsMigration(doc) || originalVersion >= targetVersion) {
    return {
      doc,
      migrated: false,
      originalVersion,
      finalVersion: originalVersion,
      migrationsApplied: 0,
    };
  }

  // Get migration chain
  const chain = getMigrationChain(modelType, originalVersion, targetVersion);

  // Apply migrations
  let currentDoc = doc;
  let migrationsApplied = 0;

  for (const migration of chain) {
    try {
      currentDoc = migration.migrate(currentDoc) as T;
      migrationsApplied++;
    } catch (error) {
      throw new MigrationError(
        migration.fromVersion,
        migration.toVersion,
        modelType,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  return {
    doc: currentDoc,
    migrated: migrationsApplied > 0,
    originalVersion,
    finalVersion: targetVersion,
    migrationsApplied,
  };
}

/**
 * Migrate a document if needed, returning the document unchanged if no migration is required.
 * This is a convenience wrapper around migrateDocument.
 *
 * @param doc - The document to migrate
 * @param modelType - The model type
 * @returns The migrated document (or original if no migration needed)
 */
export function migrateIfNeeded<T extends Partial<VersionedModel>>(
  doc: T,
  modelType: string,
): T {
  const result = migrateDocument(doc, modelType);
  return result.doc;
}

/**
 * Set the schema version on a document.
 * Used when creating new documents or after migration.
 *
 * @param doc - The document to update
 * @param version - The version to set (defaults to SDK_SCHEMA_VERSION)
 * @returns The document with version set
 */
export function setSchemaVersion<T extends object>(
  doc: T,
  version: number = SDK_SCHEMA_VERSION,
): T & VersionedModel {
  return {
    ...doc,
    __schemaVersion: version,
  } as T & VersionedModel;
}
