import type { QueryOptions } from "jazz-tools";
import type { JazzFateDb } from "fate-jazz";
import { trizumEntityDefinitions } from "./repository.js";

type PersistedScalar = boolean | number | string | null;
type PersistedValue = PersistedScalar | PersistedValue[] | { [key: string]: PersistedValue };
type PersistedRow = {
  id: string;
  [key: string]: PersistedValue | undefined;
};
type PersistedSnapshot = {
  tables: Record<string, Record<string, PersistedRow>>;
  version: 1;
};
type TableDefinition = (typeof trizumEntityDefinitions)[number];
type TableProxy = {
  _schema?: Record<
    string,
    {
      columns: Array<{
        column_type: {
          type: string;
        };
        name: string;
      }>;
    }
  >;
  _table?: string;
};
type WriteHandleLike<T = unknown> = T & {
  wait?: (options: Pick<QueryOptions, "tier">) => Promise<unknown>;
};

const fallbackDbName = "trizum-jazz-browser-fallback";
const snapshotsStoreName = "snapshots";
const snapshotVersion = 1;
const defaultQueryOptions = {
  propagation: "local-only",
  tier: "local",
} satisfies QueryOptions;

export async function createBrowserFallbackPersistentDb({
  db,
  namespace,
  queryOptions = defaultQueryOptions,
}: {
  db: JazzFateDb;
  namespace: string;
  queryOptions?: QueryOptions;
}): Promise<JazzFateDb> {
  const mirror = await BrowserFallbackMirror.open(namespace);

  await mirror.hydrate(db, queryOptions);

  return mirror.wrap(db);
}

export function canUseBrowserFallbackPersistence() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

class BrowserFallbackMirror {
  private saveQueue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly namespace: string,
    private readonly store: SnapshotStore,
    private readonly snapshot: PersistedSnapshot,
  ) {}

  static async open(namespace: string) {
    const store = await SnapshotStore.open();
    const snapshot = normalizeSnapshot(await store.get(namespace));

    return new BrowserFallbackMirror(namespace, store, snapshot);
  }

  async hydrate(db: JazzFateDb, queryOptions: QueryOptions) {
    for (const definition of trizumEntityDefinitions) {
      const tableName = getTableName(definition.table);
      const rows = Object.values(this.snapshot.tables[tableName] ?? {});

      for (const row of rows) {
        const hydratedRow = deserializeRow(definition, row);
        const { id, ...input } = hydratedRow;
        const result = upsertRaw(db, definition.table, input, { id });

        await waitForWrite(result, queryOptions);
      }
    }
  }

  wrap(db: JazzFateDb): JazzFateDb {
    const wrapped = {
      all: db.all.bind(db),
      delete: (table: unknown, id: string) => {
        const result = deleteRaw(db, table, id);

        return withPersistedWait(result, () => this.removeRow(table, id));
      },
      insert: (
        table: unknown,
        input: unknown,
        options:
          | {
              id?: string;
            }
          | undefined,
      ) => {
        const result = insertRaw(db, table, input, options);

        return withPersistedWait(result, () => this.putRow(table, result.value));
      },
      one: db.one.bind(db),
      update: (table: unknown, id: string, input: unknown) => {
        const result = updateRaw(db, table, id, input);

        return withPersistedWait(result, () => this.mergeRow(table, id, input));
      },
      upsert: (
        table: unknown,
        input: unknown,
        options: {
          id: string;
        },
      ) => {
        const result = upsertRaw(db, table, input, options);

        return withPersistedWait(result, () => this.mergeRow(table, options.id, input));
      },
    };

    return wrapped as unknown as JazzFateDb;
  }

  private putRow(table: unknown, row: unknown) {
    if (!isRowLike(row)) {
      return Promise.resolve();
    }

    const definition = getDefinitionForTable(table);
    const tableName = getTableName(table);
    const tableRows = (this.snapshot.tables[tableName] ??= {});
    tableRows[row.id] = serializeRow(definition, row);

    return this.enqueueSave();
  }

  private mergeRow(table: unknown, id: string, input: unknown) {
    if (!isObjectRecord(input)) {
      return Promise.resolve();
    }

    const definition = getDefinitionForTable(table);
    const tableName = getTableName(table);
    const tableRows = (this.snapshot.tables[tableName] ??= {});
    const current = tableRows[id] ?? { id };
    tableRows[id] = serializeRow(definition, {
      ...current,
      ...input,
      id,
    });

    return this.enqueueSave();
  }

  private removeRow(table: unknown, id: string) {
    const tableName = getTableName(table);
    const tableRows = this.snapshot.tables[tableName];

    if (tableRows) {
      delete tableRows[id];
    }

    return this.enqueueSave();
  }

  private enqueueSave() {
    const next = this.saveQueue
      .catch(() => undefined)
      .then(() => this.store.put(this.namespace, this.snapshot));

    this.saveQueue = next.catch(() => undefined);

    return next;
  }
}

class SnapshotStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open() {
    const db = await openIndexedDb(fallbackDbName, snapshotVersion, (database) => {
      if (!database.objectStoreNames.contains(snapshotsStoreName)) {
        database.createObjectStore(snapshotsStoreName);
      }
    });

    return new SnapshotStore(db);
  }

  async get(namespace: string) {
    const transaction = this.db.transaction(snapshotsStoreName, "readonly");
    const request = transaction.objectStore(snapshotsStoreName).get(namespace);
    const [value] = await Promise.all([requestToPromise(request), transactionDone(transaction)]);

    return value;
  }

  async put(namespace: string, snapshot: PersistedSnapshot) {
    const transaction = this.db.transaction(snapshotsStoreName, "readwrite");
    transaction.objectStore(snapshotsStoreName).put(snapshot, namespace);

    await transactionDone(transaction);
  }
}

function normalizeSnapshot(value: unknown): PersistedSnapshot {
  if (
    value &&
    typeof value === "object" &&
    (value as { version?: unknown }).version === snapshotVersion &&
    isObjectRecord((value as { tables?: unknown }).tables)
  ) {
    return value as PersistedSnapshot;
  }

  return {
    tables: {},
    version: snapshotVersion,
  };
}

function serializeRow(definition: TableDefinition, row: Record<string, unknown>): PersistedRow {
  const serialized: PersistedRow = {
    id: String(row.id),
  };

  for (const column of definition.columns) {
    if (column === "id" || !(column in row)) {
      continue;
    }

    serialized[column] = serializeColumnValue(definition, column, row[column]);
  }

  return serialized;
}

function deserializeRow(
  definition: TableDefinition,
  row: PersistedRow,
): Record<string, unknown> & { id: string } {
  const deserialized: Record<string, unknown> & { id: string } = {
    id: row.id,
  };

  for (const column of definition.columns) {
    if (column === "id" || !(column in row)) {
      continue;
    }

    deserialized[column] = deserializeColumnValue(definition, column, row[column]);
  }

  return deserialized;
}

function serializeColumnValue(
  definition: TableDefinition,
  column: string,
  value: unknown,
): PersistedValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (isTimestampColumn(definition, column)) {
    return value instanceof Date ? value.getTime() : Number(value);
  }

  return value as PersistedValue;
}

function deserializeColumnValue(
  definition: TableDefinition,
  column: string,
  value: PersistedValue | undefined,
) {
  if (value === undefined || value === null) {
    return value;
  }

  if (isTimestampColumn(definition, column)) {
    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      const numericValue = Number(value);

      return new Date(Number.isFinite(numericValue) ? numericValue : value);
    }

    return new Date(Number(value));
  }

  return value;
}

function isTimestampColumn(definition: TableDefinition, column: string) {
  const table = definition.table as TableProxy;
  const tableName = getTableName(definition.table);

  return (
    table._schema?.[tableName]?.columns.find((candidate) => candidate.name === column)?.column_type
      .type === "Timestamp"
  );
}

function getDefinitionForTable(table: unknown) {
  const tableName = getTableName(table);
  const definition = trizumEntityDefinitions.find(
    (candidate) => getTableName(candidate.table) === tableName,
  );

  if (!definition) {
    throw new Error(`Cannot persist unknown Jazz table: ${tableName}`);
  }

  return definition;
}

function getTableName(table: unknown) {
  const tableName = (table as TableProxy)._table;

  if (typeof tableName !== "string") {
    throw new Error("Cannot persist Jazz table without a table name");
  }

  return tableName;
}

function isRowLike(value: unknown): value is Record<string, unknown> & { id: string } {
  return isObjectRecord(value) && typeof value.id === "string";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function insertRaw(
  db: JazzFateDb,
  table: unknown,
  input: unknown,
  options?: {
    id?: string;
  },
) {
  return (
    db.insert as (
      table: unknown,
      input: unknown,
      options?: {
        id?: string;
      },
    ) => WriteHandleLike<{ value: unknown }>
  )(table, input, options);
}

function upsertRaw(
  db: JazzFateDb,
  table: unknown,
  input: unknown,
  options: {
    id: string;
  },
) {
  return (
    db.upsert as (
      table: unknown,
      input: unknown,
      options: {
        id: string;
      },
    ) => WriteHandleLike
  )(table, input, options);
}

function updateRaw(db: JazzFateDb, table: unknown, id: string, input: unknown) {
  return (db.update as (table: unknown, id: string, input: unknown) => WriteHandleLike)(
    table,
    id,
    input,
  );
}

function deleteRaw(db: JazzFateDb, table: unknown, id: string) {
  return (db.delete as (table: unknown, id: string) => WriteHandleLike)(table, id);
}

function withPersistedWait<T extends WriteHandleLike>(
  result: T,
  persist: () => Promise<unknown>,
): T {
  if (typeof result.wait !== "function") {
    void persist();
    return result;
  }

  const originalWait = result.wait.bind(result);

  return {
    ...result,
    wait: async (options: Pick<QueryOptions, "tier">) => {
      const value = await originalWait(options);
      await persist();

      return value;
    },
  };
}

async function waitForWrite(result: WriteHandleLike, queryOptions: QueryOptions) {
  if (typeof result.wait !== "function") {
    return;
  }

  await result.wait({ tier: queryOptions.tier });
}

function openIndexedDb(name: string, version: number, upgrade: (database: IDBDatabase) => void) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`IndexedDB open blocked for ${name}`));
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
