import { describe, test, expect, beforeEach } from "vitest";
import {
  registerMigration,
  clearMigrations,
  getMigration,
  getMigrationsForModel,
  getMigrationChain,
  hasMigrationPath,
  getRegisteredModelTypes,
} from "./registry.js";
import {
  migrateDocument,
  migrateIfNeeded,
  setSchemaVersion,
} from "./runner.js";
import {
  VersionMismatchError,
  MigrationError,
  NoMigrationPathError,
} from "./errors.js";
import {
  SDK_SCHEMA_VERSION,
  needsMigration,
  isFromNewerSdk,
} from "../models/versioned.js";

interface TestDocument {
  __schemaVersion: number;
  id: string;
  name: string;
  value?: number;
  newField?: string;
}

describe("Migration Registry", () => {
  beforeEach(() => {
    clearMigrations();
  });

  test("should register a migration", () => {
    const migration = {
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 1 }),
    };

    registerMigration(migration);

    expect(getMigration("test", 0)).toBe(migration);
  });

  test("should return undefined for unregistered migration", () => {
    expect(getMigration("test", 0)).toBeUndefined();
  });

  test("should get all migrations for a model", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 1 }),
    });

    registerMigration({
      modelType: "test",
      fromVersion: 1,
      toVersion: 2,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 2 }),
    });

    const migrations = getMigrationsForModel("test");

    expect(migrations).toHaveLength(2);
    expect(migrations[0].fromVersion).toBe(0);
    expect(migrations[1].fromVersion).toBe(1);
  });

  test("should get migration chain", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 1 }),
    });

    registerMigration({
      modelType: "test",
      fromVersion: 1,
      toVersion: 2,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 2 }),
    });

    const chain = getMigrationChain("test", 0, 2);

    expect(chain).toHaveLength(2);
    expect(chain[0].fromVersion).toBe(0);
    expect(chain[1].fromVersion).toBe(1);
  });

  test("should return empty chain when fromVersion >= toVersion", () => {
    const chain = getMigrationChain("test", 2, 1);
    expect(chain).toHaveLength(0);
  });

  test("should throw NoMigrationPathError when path is incomplete", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 1 }),
    });

    expect(() => getMigrationChain("test", 0, 3)).toThrow(NoMigrationPathError);
  });

  test("should check if migration path exists", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({ ...doc, __schemaVersion: 1 }),
    });

    expect(hasMigrationPath("test", 0, 1)).toBe(true);
    expect(hasMigrationPath("test", 0, 2)).toBe(false);
  });

  test("should get registered model types", () => {
    registerMigration({
      modelType: "party",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => doc,
    });

    registerMigration({
      modelType: "expense",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => doc,
    });

    const types = getRegisteredModelTypes();

    expect(types).toContain("party");
    expect(types).toContain("expense");
  });
});

describe("Migration Runner", () => {
  beforeEach(() => {
    clearMigrations();
  });

  test("should migrate document through single migration", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({
        ...doc,
        __schemaVersion: 1,
        newField: "added",
      }),
    });

    const doc: TestDocument = {
      __schemaVersion: 0,
      id: "1",
      name: "test",
    };

    const result = migrateDocument(doc, "test", { targetVersion: 1 });

    expect(result.migrated).toBe(true);
    expect(result.originalVersion).toBe(0);
    expect(result.finalVersion).toBe(1);
    expect(result.migrationsApplied).toBe(1);
    expect(result.doc.newField).toBe("added");
  });

  test("should migrate document through chain of migrations", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({
        ...doc,
        __schemaVersion: 1,
        value: 10,
      }),
    });

    registerMigration({
      modelType: "test",
      fromVersion: 1,
      toVersion: 2,
      migrate: (doc: TestDocument) => ({
        ...doc,
        __schemaVersion: 2,
        value: (doc.value ?? 0) * 2,
      }),
    });

    const doc: TestDocument = {
      __schemaVersion: 0,
      id: "1",
      name: "test",
    };

    const result = migrateDocument(doc, "test", { targetVersion: 2 });

    expect(result.migrated).toBe(true);
    expect(result.migrationsApplied).toBe(2);
    expect(result.doc.value).toBe(20);
  });

  test("should not migrate when already at target version", () => {
    const doc: TestDocument = {
      __schemaVersion: SDK_SCHEMA_VERSION,
      id: "1",
      name: "test",
    };

    const result = migrateDocument(doc, "test");

    expect(result.migrated).toBe(false);
    expect(result.migrationsApplied).toBe(0);
  });

  test("should throw VersionMismatchError for newer documents", () => {
    const doc: TestDocument = {
      __schemaVersion: SDK_SCHEMA_VERSION + 1,
      id: "1",
      name: "test",
    };

    expect(() => migrateDocument(doc, "test")).toThrow(VersionMismatchError);
  });

  test("should not throw for newer documents when throwOnNewerVersion is false", () => {
    const doc: TestDocument = {
      __schemaVersion: SDK_SCHEMA_VERSION + 1,
      id: "1",
      name: "test",
    };

    const result = migrateDocument(doc, "test", { throwOnNewerVersion: false });

    expect(result.migrated).toBe(false);
  });

  test("should throw MigrationError when migration fails", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: () => {
        throw new Error("Migration failed");
      },
    });

    const doc: TestDocument = {
      __schemaVersion: 0,
      id: "1",
      name: "test",
    };

    expect(() => migrateDocument(doc, "test", { targetVersion: 1 })).toThrow(
      MigrationError,
    );
  });

  test("should handle documents without __schemaVersion", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({
        ...doc,
        __schemaVersion: 1,
      }),
    });

    const doc = {
      id: "1",
      name: "test",
    } as TestDocument;

    const result = migrateDocument(doc, "test", { targetVersion: 1 });

    expect(result.migrated).toBe(true);
    expect(result.originalVersion).toBe(0);
  });
});

describe("migrateIfNeeded", () => {
  beforeEach(() => {
    clearMigrations();
  });

  test("should return migrated document", () => {
    registerMigration({
      modelType: "test",
      fromVersion: 0,
      toVersion: 1,
      migrate: (doc: TestDocument) => ({
        ...doc,
        __schemaVersion: 1,
        newField: "migrated",
      }),
    });

    const doc: TestDocument = {
      __schemaVersion: 0,
      id: "1",
      name: "test",
    };

    const result = migrateIfNeeded(doc, "test");

    expect(result.newField).toBe("migrated");
  });
});

describe("setSchemaVersion", () => {
  test("should set schema version on document", () => {
    const doc = { id: "1", name: "test" };
    const result = setSchemaVersion(doc, 5);

    expect(result.__schemaVersion).toBe(5);
  });

  test("should default to SDK_SCHEMA_VERSION", () => {
    const doc = { id: "1", name: "test" };
    const result = setSchemaVersion(doc);

    expect(result.__schemaVersion).toBe(SDK_SCHEMA_VERSION);
  });
});

describe("Versioning Utilities", () => {
  test("needsMigration should return true for older versions", () => {
    expect(needsMigration({ __schemaVersion: 0 })).toBe(true);
    // When SDK_SCHEMA_VERSION is 1, version 0 (SDK_SCHEMA_VERSION - 1) needs migration
    // When SDK_SCHEMA_VERSION > 1, any version less than current needs migration
    if (SDK_SCHEMA_VERSION > 1) {
      expect(needsMigration({ __schemaVersion: SDK_SCHEMA_VERSION - 1 })).toBe(
        true,
      );
    }
  });

  test("needsMigration should return false for current version", () => {
    expect(needsMigration({ __schemaVersion: SDK_SCHEMA_VERSION })).toBe(false);
  });

  test("needsMigration should return true for missing version (treated as 0)", () => {
    expect(needsMigration({})).toBe(true);
  });

  test("isFromNewerSdk should return true for newer versions", () => {
    expect(isFromNewerSdk({ __schemaVersion: SDK_SCHEMA_VERSION + 1 })).toBe(
      true,
    );
  });

  test("isFromNewerSdk should return false for current or older versions", () => {
    expect(isFromNewerSdk({ __schemaVersion: SDK_SCHEMA_VERSION })).toBe(false);
    expect(isFromNewerSdk({ __schemaVersion: 0 })).toBe(false);
  });
});

describe("Error Classes", () => {
  test("VersionMismatchError should have correct properties", () => {
    const error = new VersionMismatchError(5, 3);

    expect(error.name).toBe("VersionMismatchError");
    expect(error.documentVersion).toBe(5);
    expect(error.sdkVersion).toBe(3);
    expect(error.message).toContain("5");
    expect(error.message).toContain("3");
  });

  test("MigrationError should have correct properties", () => {
    const cause = new Error("cause");
    const error = new MigrationError(1, 2, "party", cause);

    expect(error.name).toBe("MigrationError");
    expect(error.fromVersion).toBe(1);
    expect(error.toVersion).toBe(2);
    expect(error.modelType).toBe("party");
    expect(error.cause).toBe(cause);
  });

  test("NoMigrationPathError should have correct properties", () => {
    const error = new NoMigrationPathError(1, 5, "expense");

    expect(error.name).toBe("NoMigrationPathError");
    expect(error.fromVersion).toBe(1);
    expect(error.toVersion).toBe(5);
    expect(error.modelType).toBe("expense");
  });
});
