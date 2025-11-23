import type { Database } from "#src/db.ts";
import { CURRENT_TIMESTAMP } from "#src/db/columns.helpers.ts";
import { automergeKV } from "#src/db/schema.ts";
import type {
  Chunk,
  StorageAdapterInterface,
  StorageKey,
} from "@automerge/automerge-repo/slim";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export class DrizzleSqliteStorageAdapter implements StorageAdapterInterface {
  constructor(private readonly db: Database) {}

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    const dbKey = storageKeyToDbKey(key);
    const result = await this.db.query.automergeKV.findFirst({
      where: (table, { eq }) => eq(table.key, dbKey),
    });

    if (!result) {
      return;
    }

    return bufferToUint8Array(result.value);
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    const dbKey = storageKeyToDbKey(key);

    await this.db
      .insert(automergeKV)
      .values({
        key: dbKey,
        value: uint8ArrayToBuffer(data),
        isDocument: isAutomergeDocumentKey(key),
      })
      .onConflictDoUpdate({
        target: automergeKV.key,
        set: {
          value: uint8ArrayToBuffer(data),
          updatedAt: CURRENT_TIMESTAMP,
        },
      });
  }

  async remove(key: StorageKey): Promise<void> {
    const dbKey = storageKeyToDbKey(key);
    await this.db.delete(automergeKV).where(eq(automergeKV.key, dbKey));
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const dbKey = storageKeyToDbKey(keyPrefix);
    const result = await this.db.query.automergeKV.findMany({
      where: (table) => sql`${table.key} GLOB ${`${dbKey}*`}`,
    });

    return result.map((row) => ({
      key: dbKeyToStorageKey(row.key),
      data: bufferToUint8Array(row.value),
    }));
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    const dbKey = storageKeyToDbKey(keyPrefix);

    await this.db
      .delete(automergeKV)
      .where(sql`${automergeKV.key} GLOB ${`${dbKey}*`}`);
  }
}

function storageKeyToDbKey(key: StorageKey): string {
  return key.join(".");
}

function dbKeyToStorageKey(key: string): StorageKey {
  return key.split(".");
}

export type AutomergeDocumentChunkType =
  | "snapshot"
  | "incremental"
  | "sync-state";
export type AutomergeDocumentKey = [string, AutomergeDocumentChunkType, string];

const AutomergeDocumentKeySchema = z.tuple([
  z.string(),
  z.enum(["snapshot", "incremental", "sync-state"]),
  z.string(),
]);

function isAutomergeDocumentKey(key: StorageKey): key is AutomergeDocumentKey {
  return AutomergeDocumentKeySchema.safeParse(key).success;
}

function bufferToUint8Array(buf: Buffer): Uint8Array {
  return new Uint8Array(
    buf.buffer,
    buf.byteOffset,
    buf.length / Uint8Array.BYTES_PER_ELEMENT,
  );
}

function uint8ArrayToBuffer(arr: Uint8Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length);
}
