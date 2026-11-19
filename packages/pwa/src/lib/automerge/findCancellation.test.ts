import { generateAutomergeUrl, Repo } from "@automerge/automerge-repo";
import type { Chunk, StorageAdapterInterface } from "@automerge/automerge-repo/slim";
import { expect, test } from "vite-plus/test";

for (const outcome of ["resolve", "reject"] as const) {
  test(`find cancellation rejects before storage finishes and handles its later ${outcome}`, async () => {
    const loading = createDeferred<Chunk[]>();
    const started = createDeferred<void>();

    const storage: StorageAdapterInterface = {
      load: async () => undefined,
      save: async () => {},
      remove: async () => {},
      removeRange: async () => {},
      loadRange: () => {
        started.resolve();

        return loading.promise;
      },
    };

    const repo = new Repo({ storage, network: [] });
    const controller = new AbortController();

    const finding = repo
      .find(generateAutomergeUrl(), { signal: controller.signal })
      .catch((error: Error) => error);

    try {
      await started.promise;
      controller.abort();
      // Cancellation must settle without waiting for the storage operation.
      await expect(finding).resolves.toMatchObject({ name: "AbortError", code: 20 });
    } finally {
      if (outcome === "resolve") loading.resolve([]);
      else loading.reject(new Error("Storage read failed after cancellation"));

      // Let the storage continuation run; Vitest also checks unhandled rejections.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
