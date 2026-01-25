/**
 * Schema versioning for SDK models.
 *
 * All documents in the SDK have a schema version to support migrations
 * when the data model changes.
 */

/**
 * Current SDK schema version.
 * Increment this when making breaking changes to model schemas.
 */
export const SDK_SCHEMA_VERSION = 1;

/**
 * Base interface for versioned models.
 * All document models should extend this interface.
 */
export interface VersionedModel {
  /**
   * Schema version of this document.
   * Used for migrations when loading documents with older schemas.
   * Optional - documents without this field are treated as version 0.
   */
  __schemaVersion?: number;
}

/**
 * Check if a document needs migration.
 *
 * @param doc - The document to check
 * @returns true if the document needs migration
 */
export function needsMigration(doc: Partial<VersionedModel>): boolean {
  const version = doc.__schemaVersion ?? 0;
  return version < SDK_SCHEMA_VERSION;
}

/**
 * Check if a document is from a newer SDK version.
 *
 * @param doc - The document to check
 * @returns true if the document is from a newer SDK
 */
export function isFromNewerSdk(doc: Partial<VersionedModel>): boolean {
  const version = doc.__schemaVersion ?? 0;
  return version > SDK_SCHEMA_VERSION;
}
