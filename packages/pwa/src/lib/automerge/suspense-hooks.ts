import type {
  AnyDocumentId,
  Doc,
  DocHandle,
  Repo,
} from "@automerge/automerge-repo/slim";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useSyncExternalStore } from "react";

import { createCache, type Cache } from "suspense";

export const handleCache = createCache<
  [Repo, AnyDocumentId],
  DocHandle<unknown>
>({
  async load([repo, id]) {
    return repo.find(id);
  },
  getKey: ([_, id]) => String(id),
});

const getDocumentCacheKey = ([_, id]: [Repo, AnyDocumentId]) => String(id);

export const documentCache = withLiveSubscription<
  [Repo, AnyDocumentId],
  Doc<unknown> | undefined
>({
  getKey: getDocumentCacheKey,
  getCache: ({ onEviction, getKey, onUpdate }) =>
    createCache({
      async load(params) {
        const [repo, id] = params;
        const handle = await handleCache.readAsync(repo, id);
        const doc = await handle.doc();

        function onChange() {
          onUpdate(params, handle.docSync());
        }

        function onDelete() {
          onUpdate(params, undefined);
        }

        handle.on("delete", onDelete);
        handle.on("change", onChange);

        onEviction(params, () => {
          handle.off("delete", onDelete);
          handle.off("change", onChange);
        });

        return doc;
      },
      getKey,
    }),
});

function withLiveSubscription<Params extends any[], Value>({
  getCache,
  getKey,
}: {
  getCache: (params: {
    onEviction: (params: Params, listener: () => void) => void;
    onUpdate: (params: Params, value: Value) => void;
    getKey: (params: Params) => string;
  }) => Cache<Params, Value>;
  getKey: (params: Params) => string;
}): Cache<Params, Value> {
  const evictionListeners = new Map<string, () => void>();

  function onEviction(params: Params, listener: () => void) {
    const key = getKey(params);
    evictionListeners.set(key, listener);

    return () => {
      evictionListeners.delete(key);
    };
  }

  const cache = getCache({ onEviction, onUpdate, getKey });

  function onUpdate(params: Params, value: Value) {
    cache.cache(value, ...params);
  }

  return {
    ...cache,
    evict: (...params) => {
      const key = getKey(params);
      const listener = evictionListeners.get(key);

      if (listener) {
        // Call the listener to remove the subscription
        listener();
      }

      return cache.evict(...params);
    },
    evictAll() {
      evictionListeners.forEach((listener) => listener());
      return cache.evictAll();
    },
  };
}

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

  // Suspense cache read to ensure the document is loaded
  documentCache.read(repo, id);

  const doc = useSyncExternalStore(
    (change) => {
      return documentCache.subscribe(change, repo, id);
    },
    () => {
      return documentCache.getValueIfCached(repo, id);
    },
  );

  if (options?.required && !doc) {
    throw new Error(`Document not found: ${id}`);
  }

  return [doc as Doc<T> | undefined, handle] as const;
}
