/**
 * Migration registry for managing model migrations.
 */

import type { VersionedModel } from "../models/versioned.js";
import { NoMigrationPathError } from "./errors.js";

/**
 * A migration function that transforms a document from one version to the next.
 */
export type MigrationFn<T = unknown> = (doc: T) => T;

/**
 * A registered migration with metadata.
 */
export interface Migration<T = unknown> {
  /** Model type this migration applies to */
  modelType: string;
  /** Source version (migrate from this version) */
  fromVersion: number;
  /** Target version (migrate to this version) */
  toVersion: number;
  /** The migration function */
  migrate: MigrationFn<T>;
  /** Optional description of what this migration does */
  description?: string;
}

/**
 * Global registry of migrations.
 * Maps model type -> fromVersion -> Migration
 */
const migrations = new Map<string, Map<number, Migration>>();

/**
 * Register a migration for a model type.
 *
 * @param migration - The migration to register
 */
export function registerMigration<T extends VersionedModel>(
  migration: Migration<T>,
): void {
  let modelMigrations = migrations.get(migration.modelType);

  if (!modelMigrations) {
    modelMigrations = new Map();
    migrations.set(migration.modelType, modelMigrations);
  }

  modelMigrations.set(migration.fromVersion, migration as Migration);
}

/**
 * Get the migration for a specific version transition.
 *
 * @param modelType - The model type
 * @param fromVersion - The source version
 * @returns The migration if found, undefined otherwise
 */
export function getMigration(
  modelType: string,
  fromVersion: number,
): Migration | undefined {
  const modelMigrations = migrations.get(modelType);
  return modelMigrations?.get(fromVersion);
}

/**
 * Get all migrations for a model type.
 *
 * @param modelType - The model type
 * @returns Array of migrations sorted by fromVersion
 */
export function getMigrationsForModel(modelType: string): Migration[] {
  const modelMigrations = migrations.get(modelType);
  if (!modelMigrations) {
    return [];
  }

  return Array.from(modelMigrations.values()).sort(
    (a, b) => a.fromVersion - b.fromVersion,
  );
}

/**
 * Get the migration chain needed to migrate from one version to another.
 *
 * @param modelType - The model type
 * @param fromVersion - The source version
 * @param toVersion - The target version
 * @returns Array of migrations to apply in order
 * @throws NoMigrationPathError if no valid path exists
 */
export function getMigrationChain(
  modelType: string,
  fromVersion: number,
  toVersion: number,
): Migration[] {
  if (fromVersion >= toVersion) {
    return [];
  }

  const chain: Migration[] = [];
  let currentVersion = fromVersion;

  while (currentVersion < toVersion) {
    const migration = getMigration(modelType, currentVersion);

    if (!migration) {
      throw new NoMigrationPathError(fromVersion, toVersion, modelType);
    }

    chain.push(migration);
    currentVersion = migration.toVersion;
  }

  return chain;
}

/**
 * Check if a migration path exists.
 *
 * @param modelType - The model type
 * @param fromVersion - The source version
 * @param toVersion - The target version
 * @returns true if a valid migration path exists
 */
export function hasMigrationPath(
  modelType: string,
  fromVersion: number,
  toVersion: number,
): boolean {
  try {
    getMigrationChain(modelType, fromVersion, toVersion);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all registered migrations.
 * Primarily used for testing.
 */
export function clearMigrations(): void {
  migrations.clear();
}

/**
 * Get all registered model types.
 *
 * @returns Array of model types that have migrations registered
 */
export function getRegisteredModelTypes(): string[] {
  return Array.from(migrations.keys());
}
