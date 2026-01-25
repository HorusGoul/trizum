/**
 * Migration error classes.
 */

/**
 * Error thrown when a document's schema version is newer than the SDK supports.
 * This typically means the user needs to update their SDK.
 */
export class VersionMismatchError extends Error {
  readonly documentVersion: number;
  readonly sdkVersion: number;

  constructor(documentVersion: number, sdkVersion: number) {
    super(
      `Document schema version (${documentVersion}) is newer than SDK version (${sdkVersion}). ` +
        `Please update your SDK to load this document.`,
    );
    this.name = "VersionMismatchError";
    this.documentVersion = documentVersion;
    this.sdkVersion = sdkVersion;
  }
}

/**
 * Error thrown when a migration fails.
 */
export class MigrationError extends Error {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly modelType: string;
  readonly cause?: Error;

  constructor(
    fromVersion: number,
    toVersion: number,
    modelType: string,
    cause?: Error,
  ) {
    super(
      `Failed to migrate ${modelType} from version ${fromVersion} to ${toVersion}` +
        (cause ? `: ${cause.message}` : ""),
    );
    this.name = "MigrationError";
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
    this.modelType = modelType;
    this.cause = cause;
  }
}

/**
 * Error thrown when no migration path exists.
 */
export class NoMigrationPathError extends Error {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly modelType: string;

  constructor(fromVersion: number, toVersion: number, modelType: string) {
    super(
      `No migration path found for ${modelType} from version ${fromVersion} to ${toVersion}`,
    );
    this.name = "NoMigrationPathError";
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
    this.modelType = modelType;
  }
}
