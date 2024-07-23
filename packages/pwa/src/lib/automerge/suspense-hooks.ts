import type {
  AnyDocumentId,
  Doc,
  DocHandle,
  DocHandleChangePayload,
  DocHandleDeletePayload,
  Repo,
} from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useEffect, useState } from "react";

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
  Doc<unknown> | null
>({
  async load([repo, id]) {
    const handle = await handleCache.readAsync(repo, id);
    const doc = await handle.doc();
    return doc ?? null;
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
): [Doc<T> | null, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends
    UseSuspenseDocumentOptions<false> = UseSuspenseDocumentOptions<false>,
>(id: AnyDocumentId, options?: Options): [Doc<T> | null, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends
    UseSuspenseDocumentOptions<true> = UseSuspenseDocumentOptions<true>,
>(id: AnyDocumentId, options: Options): [Doc<T>, DocHandle<T>];
export function useSuspenseDocument<
  T,
  Options extends UseSuspenseDocumentOptions = UseSuspenseDocumentOptions,
>(id: AnyDocumentId, options?: Options): [Doc<T> | null, DocHandle<T>] {
  const repo = useRepo();
  const handle = useSuspenseHandle<T>(id);
  const { mutateSync } = useCacheMutation(documentCache);
  const doc = documentCache.read(repo, id) as Doc<T> | null;
  const [, setRenderCount] = useState(0);

  useEffect(() => {
    function rerender(
      payload: DocHandleChangePayload<T> | DocHandleDeletePayload<T>,
    ) {
      setRenderCount((count) => count + 1);
      mutateSync([repo, id], payload.handle.docSync() ?? null);
    }

    handle.on("change", rerender);
    handle.on("delete", rerender);

    return () => {
      handle.removeListener("change", rerender);
      handle.removeListener("delete", rerender);
    };
  }, [handle, mutateSync, repo, id]);

  if (options?.required && doc === null) {
    throw new Error(`Document not found: ${id}`);
  }

  return [doc, handle] as const;
}
