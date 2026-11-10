import type { StorageAdapterInterface } from "@automerge/automerge-repo/slim";
import { expect, test, vi } from "vite-plus/test";
import { createRecoveringStorage } from "./recoveringStorage.ts";

function storageThatFails(error?: DOMException): StorageAdapterInterface {
  async function check() {
    if (error) throw error;
  }

  return {
    load: async () => {
      await check();

      return undefined;
    },
    save: check,
    remove: check,
    loadRange: async () => {
      await check();

      return [];
    },
    removeRange: check,
  };
}

const closing = new DOMException("The database connection is closing.", "InvalidStateError");

test("concurrent operations share a replacement for a closed connection", async () => {
  const replacement = storageThatFails();
  const save = vi.spyOn(replacement, "save");

  const factory = vi
    .fn<() => StorageAdapterInterface>(() => replacement)
    .mockReturnValueOnce(storageThatFails(closing));

  const storage = createRecoveringStorage(factory);
  const binary = new Uint8Array([42]);

  await Promise.all([
    storage.save(["doc"], binary),
    storage.load(["doc"]),
    storage.remove(["old"]),
    storage.loadRange(["doc"]),
    storage.removeRange(["old"]),
  ]);
  expect(factory).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenCalledWith(["doc"], binary);
});

test("persistent connection errors reject after one retry", async () => {
  const factory = vi.fn<() => StorageAdapterInterface>(() => storageThatFails(closing));
  await expect(createRecoveringStorage(factory).save(["doc"], new Uint8Array())).rejects.toBe(
    closing,
  );
  expect(factory).toHaveBeenCalledTimes(2);
});

test("quota and transaction errors propagate without reopening", async () => {
  for (const name of ["QuotaExceededError", "AbortError", "UnknownError"]) {
    const error = new DOMException("Storage failed", name);
    const factory = vi.fn<() => StorageAdapterInterface>(() => storageThatFails(error));
    await expect(createRecoveringStorage(factory).save(["doc"], new Uint8Array())).rejects.toBe(
      error,
    );
    expect(factory).toHaveBeenCalledOnce();
  }
});
