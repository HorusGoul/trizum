import type {
  AnyDocumentId,
  Doc,
  DocHandle,
  Repo,
} from "@automerge/automerge-repo/slim";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useEffect, useSyncExternalStore } from "react";

import { createCache, useCacheMutation } from "suspense";

export const handleCache = createCache<
  [Repo, AnyDocumentId],
  DocHandle<unknown>
>({
  async load([repo, id]) {
    return repo.find(id);
  },
});

// TODO: This probably needs to become a streaming cache instead of a simple cache
// to facilitate real-time updates to documents
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
  documentCache.read(repo, id);

  const doc = useSyncExternalStore(
    (change) => {
      handle.on("change", change);
      handle.on("delete", change);
      return () => {
        handle.removeListener("change", change);
        handle.removeListener("delete", change);
      };
    },
    () => {
      return handle.docSync();
    },
  );

  useEffect(() => {
    mutateSync([repo, id], doc);
  }, [mutateSync, doc, repo, id]);

  if (options?.required && !doc) {
    throw new Error(`Document not found: ${id}`);
  }

  return [doc, handle] as const;
}
