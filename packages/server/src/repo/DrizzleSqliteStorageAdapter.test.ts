import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import * as schema from "#src/db/schema.ts";
import { DrizzleSqliteStorageAdapter } from "./DrizzleSqliteStorageAdapter.ts";

let directory: string;
let client: Client;
let storage: DrizzleSqliteStorageAdapter;

function openStorage() {
  client = createClient({ url: `file:${path.join(directory, "storage.db")}` });
  const db = drizzle(client, { schema });
  storage = new DrizzleSqliteStorageAdapter(db);
  return db;
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "trizum-storage-"));
  await migrate(openStorage(), {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

test("persists document chunks across reopen and updates existing keys", async () => {
  const key = ["party-a", "snapshot", "first"];
  const bytes = new Uint8Array([99, 1, 2, 3, 99]).subarray(1, 4);
  await storage.save(key, bytes);
  client.close();
  openStorage();

  expect(await storage.load(key)).toEqual(new Uint8Array([1, 2, 3]));
  await storage.save(key, new Uint8Array([4, 5]));
  expect(await storage.load(key)).toEqual(new Uint8Array([4, 5]));
  expect(await storage.load(["missing"])).toBeUndefined();
  await storage.remove(key);
  expect(await storage.load(key)).toBeUndefined();
});

test("reads and removes a document range without touching another document", async () => {
  const snapshot = ["party-a", "snapshot", "first"];
  const incremental = ["party-a", "incremental", "second"];
  const other = ["party-b", "snapshot", "first"];
  await storage.save(snapshot, new Uint8Array([1]));
  await storage.save(incremental, new Uint8Array([2]));
  await storage.save(other, new Uint8Array([3]));

  expect(await storage.loadRange(["party-a"])).toEqual(
    expect.arrayContaining([
      { key: snapshot, data: new Uint8Array([1]) },
      { key: incremental, data: new Uint8Array([2]) },
    ]),
  );
  expect(await storage.loadRange(["party-a"])).toHaveLength(2);
  await storage.removeRange(["party-a"]);
  expect(await storage.loadRange(["party-a"])).toEqual([]);
  expect(await storage.load(other)).toEqual(new Uint8Array([3]));
});

test("supports concurrent standalone chunk writes through the libSQL connection pool", async () => {
  const keys = Array.from({ length: 50 }, (_, index) => [
    "party-concurrent",
    "incremental",
    String(index),
  ]);
  await Promise.all(
    keys.map(async (key, index) => {
      await storage.save(key, new Uint8Array([index, 1]));
      expect(await storage.load(key)).toEqual(new Uint8Array([index, 1]));
      await storage.save(key, new Uint8Array([index, 2]));
    }),
  );

  const chunks = await storage.loadRange(["party-concurrent"]);
  expect(chunks).toHaveLength(keys.length);
  expect(chunks).toEqual(
    expect.arrayContaining(keys.map((key, index) => ({ key, data: new Uint8Array([index, 2]) }))),
  );
});
