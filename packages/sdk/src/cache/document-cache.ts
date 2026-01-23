/**
 * Document caching system with live subscriptions for React Suspense integration.
 *
 * This module provides caching utilities that integrate with React Suspense
 * and automatically subscribe to document changes for real-time updates.
 *
 * @internal This module is for internal SDK use only.
 */

import type { Repo, AMDocHandle } from "../internal/automerge.js";
import { toAMDocumentId } from "../internal/automerge.js";
import type { AnyDocumentId } from "../types.js";
import { createCache, type Cache } from "suspense";
import { retryWithExponentialBackoff } from "../utils/retry.js";

/**
 * @internal
 * Cache for document handles.
 */
export const handleCache = createCache<
  [Repo, AnyDocumentId],
  AMDocHandle<unknown> | undefined
>({
  async load([repo, id]) {
    try {
      const amId = toAMDocumentId(id);
      const handle = await retryWithExponentialBackoff(({ signal }) => {
        return repo.find(amId, {
          signal,
          allowableStates: ["ready"],
        });
      });

      if (handle.isDeleted()) {
        return undefined;
      }

      return handle;
    } catch {
      return undefined;
    }
  },
  getKey: ([_, id]) => String(id),
});

const getDocumentCacheKey = ([_, id]: [Repo, AnyDocumentId]) => String(id);

/**
 * @internal
 * Wrapper that adds live subscription support to a cache.
 */
function withLiveSubscription<Params extends unknown[], Value>({
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

/**
 * @internal
 * Cache for document snapshots with live subscriptions.
 * Uses `unknown` type to avoid exposing internal document types in declarations.
 */
export const documentCache = withLiveSubscription<
  [Repo, AnyDocumentId],
  unknown
>({
  getKey: getDocumentCacheKey,
  getCache: ({ onEviction, getKey, onUpdate }) =>
    createCache({
      async load(params) {
        const [repo, id] = params;
        const maybeHandle = await handleCache.readAsync(repo, id);

        if (!maybeHandle) {
          return undefined;
        }

        const handle = maybeHandle;
        const doc = handle.doc();

        function onChange() {
          onUpdate(params, handle.doc());
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

/**
 * @internal
 * Cache for loading multiple documents at once.
 * Uses `unknown` type to avoid exposing internal document types in declarations.
 */
export const multipleDocumentCache = withLiveSubscription<
  [Repo, AnyDocumentId[]],
  unknown[]
>({
  getCache: ({ onEviction, onUpdate, getKey }) =>
    createCache({
      async load(params) {
        const [repo, ids] = params;
        const docs = await Promise.all(
          ids.map((id) => Promise.resolve(documentCache.readAsync(repo, id))),
        );

        function onChange() {
          onUpdate(
            params,
            ids.map((id) => documentCache.getValueIfCached(repo, id)),
          );
        }

        const unsubscribes = ids.map((id) =>
          documentCache.subscribe(onChange, repo, id),
        );

        onEviction(params, () => {
          unsubscribes.forEach((unsubscribe) => unsubscribe());
        });

        return docs;
      },
      getKey,
    }),
  getKey: ([_, ids]) => ids.join(","),
});
