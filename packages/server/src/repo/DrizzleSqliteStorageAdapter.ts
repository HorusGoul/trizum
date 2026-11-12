import type { Database } from "#src/db.ts";
import { CURRENT_TIMESTAMP } from "#src/db/columns.helpers.ts";
import { automergeKV } from "#src/db/schema.ts";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo/slim";
import { eq, sql } from "drizzle-orm";
import { diagnosticRef } from "../diagnostics.ts";
import { rootLogger as logger } from "../log.ts";
import { z } from "zod";

export class DrizzleSqliteStorageAdapter implements StorageAdapterInterface {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    return this.observe("load", key, async () => {
      const dbKey = storageKeyToDbKey(key);

      const result = await this.db.query.automergeKV.findFirst({
        where: (table, { eq }) => eq(table.key, dbKey),
      });

      if (!result) {
        return;
      }

      return bufferToUint8Array(result.value);
    });
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    return this.observe(
      "save",
      key,
      async () => {
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
      },
      data.byteLength,
    );
  }

  async remove(key: StorageKey): Promise<void> {
    return this.observe("remove", key, async () => {
      const dbKey = storageKeyToDbKey(key);
      await this.db.delete(automergeKV).where(eq(automergeKV.key, dbKey));
    });
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    return this.observe("loadRange", keyPrefix, async () => {
      const dbKey = storageKeyToDbKey(keyPrefix);

      const result = await this.db.query.automergeKV.findMany({
        where: (table) => sql`${table.key} GLOB ${`${dbKey}*`}`,
      });

      return result.map((row) => ({
        key: dbKeyToStorageKey(row.key),
        data: bufferToUint8Array(row.value),
      }));
    });
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    return this.observe("removeRange", keyPrefix, async () => {
      const dbKey = storageKeyToDbKey(keyPrefix);

      await this.db.delete(automergeKV).where(sql`${automergeKV.key} GLOB ${`${dbKey}*`}`);
    });
  }

  private async observe<T>(
    operation: string,
    key: StorageKey,
    action: () => Promise<T>,
    writeBytes?: number,
  ): Promise<T> {
    const started = performance.now();

    const fields = {
      operation,
      documentRef: diagnosticRef(key[0] ?? ""),
      chunkType: ["snapshot", "incremental", "sync-state"].includes(key[1] ?? "")
        ? key[1]
        : "metadata",
      writeBytes,
    };

    const pending = setTimeout(() => {
      logger.warning("Storage operation still pending {operation} for {documentRef}", {
        ...fields,
        durationMs: Math.round(performance.now() - started),
      });
    }, 5000);

    pending.unref();

    try {
      const result = await action();

      const bytes =
        result instanceof Uint8Array
          ? result.byteLength
          : Array.isArray(result)
            ? result.reduce((sum, chunk: Chunk) => sum + (chunk.data?.byteLength ?? 0), 0)
            : (writeBytes ?? 0);

      const durationMs = Math.round(performance.now() - started);
      const completed = { ...fields, bytes, durationMs };

      if (durationMs >= 1000) {
        logger.warning(
          "Slow storage operation {operation} for {documentRef}: {durationMs}ms",
          completed,
        );
      } else if (bytes >= 64 * 1024) {
        logger.info(
          "Large storage operation {operation} for {documentRef}: {bytes} bytes",
          completed,
        );
      } else {
        logger.debug("Storage operation completed", completed);
      }

      return result;
    } catch (error) {
      const diagnostic = z
        .object({ code: z.string().regex(/^[A-Z0-9_]+$/) })
        .safeParse(error instanceof Error && error.cause ? error.cause : error);

      logger.error("Storage operation failed {operation} for {documentRef}", {
        ...fields,
        durationMs: Math.round(performance.now() - started),
        errorType: error instanceof Error ? error.name : "UnknownError",
        databaseCode: diagnostic.success ? diagnostic.data.code : undefined,
      });
      throw error;
    } finally {
      clearTimeout(pending);
    }
  }
}

function storageKeyToDbKey(key: StorageKey): string {
  return key.join(".");
}

function dbKeyToStorageKey(key: string): StorageKey {
  return key.split(".");
}

export type AutomergeDocumentChunkType = "snapshot" | "incremental" | "sync-state";

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
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.length / Uint8Array.BYTES_PER_ELEMENT);
}

function uint8ArrayToBuffer(arr: Uint8Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length);
}
