import type {
  AnyDocumentId,
  Doc,
  DocHandle,
  Repo,
} from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useSyncExternalStore } from "react";

import { createCache, useCacheMutation } from "suspense";

export const handleCache = createCache<
  [Repo, AnyDocumentId],
  DocHandle<unknown>
>({
  async load([repo, id]) {
    return repo.find(id);
  },
});

export const documentCache = createCache<
  [Repo, AnyDocumentId],
  Doc<unknown> | undefined
>({
  async load([repo, id]) {
    const handle = await handleCache.readAsync(repo, id);
    const doc = await handle.doc();
    return doc;
  },
});

export function useSuspenseHandle<T>(id: AnyDocumentId): DocHandle<T> {
  const repo = useRepo();
  return handleCache.read(repo, id) as DocHandle<T>;
}

interface UseSuspenseDocumentOptions<IsRequired extends boolean = false> {
  required?: IsRequired;
}

export function useSuspenseDocument<T>(
  id: AnyDocumentId,
): [Doc<T> | undefined, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends
    UseSuspenseDocumentOptions<false> = UseSuspenseDocumentOptions<false>,
>(id: AnyDocumentId, options?: Options): [Doc<T> | undefined, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends
    UseSuspenseDocumentOptions<true> = UseSuspenseDocumentOptions<true>,
>(id: AnyDocumentId, options: Options): [Doc<T>, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends UseSuspenseDocumentOptions = UseSuspenseDocumentOptions,
>(id: AnyDocumentId, options?: Options): [Doc<T> | undefined, DocHandle<T>] {
  const repo = useRepo();
  const handle = useSuspenseHandle<T>(id);
  const { mutateSync } = useCacheMutation(documentCache);

  // Suspense cache read to ensure the document is loaded
  documentCache.read(repo, id) as Doc<T> | undefined;

  const doc = useSyncExternalStore(
    (change) => {
      function update() {
        const doc = handle.docSync();
        mutateSync([repo, id], doc);
        change();
      }

      handle.on("change", update);
      handle.on("delete", update);
      return () => {
        handle.removeListener("change", update);
        handle.removeListener("delete", update);
      };
    },
    () => {
      return handle.docSync();
    },
  );

  if (options?.required && doc === null) {
    throw new Error(`Document not found: ${id}`);
  }

  return [doc, handle] as const;
}
