import type { StorageAdapterInterface } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

/** Reopen a browser-closed connection once, without hiding persistent storage failures. */
export function createRecoveringStorage(
  createAdapter: () => StorageAdapterInterface = () => new IndexedDBStorageAdapter("trizum"),
): StorageAdapterInterface {
  let adapter = createAdapter();

  async function run<T>(operation: (storage: StorageAdapterInterface) => Promise<T>): Promise<T> {
    const current = adapter;

    try {
      return await operation(current);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "InvalidStateError") throw error;

      // Concurrent operations failing on the same connection share its replacement.
      if (adapter === current) adapter = createAdapter();

      return operation(adapter);
    }
  }

  return {
    load: (key) => run((storage) => storage.load(key)),
    save: (key, binary) => run((storage) => storage.save(key, binary)),
    remove: (key) => run((storage) => storage.remove(key)),
    loadRange: (prefix) => run((storage) => storage.loadRange(prefix)),
    removeRange: (prefix) => run((storage) => storage.removeRange(prefix)),
  };
}
