/**
 * Document caching system with live subscriptions for React Suspense integration.
 *
 * This module provides caching utilities that integrate with React Suspense
 * and automatically subscribe to document changes for real-time updates.
 */

import type {
  AnyDocumentId,
  Doc,
  DocHandle,
  Repo,
} from "@automerge/automerge-repo/slim";
import { createCache, type Cache } from "suspense";
import { retryWithExponentialBackoff } from "../utils/retry.js";

/**
 * Cache for document handles.
 *
 * This cache stores document handles and automatically retries loading
 * documents with exponential backoff on failure.
 */
export const handleCache = createCache<
  [Repo, AnyDocumentId],
  DocHandle<unknown> | undefined
>({
  async load([repo, id]) {
    try {
      const handle = await retryWithExponentialBackoff(({ signal }) => {
        return repo.find(id, {
          signal,
          allowableStates: ["ready"],
        });
      });

      if (handle.isDeleted()) {
        return undefined;
      }

      return handle;
    } catch {
      // If all retries fail, return undefined to indicate the document doesn't exist
      return undefined;
    }
  },
  getKey: ([_, id]) => String(id),
});

const getDocumentCacheKey = ([_, id]: [Repo, AnyDocumentId]) => String(id);

/**
 * Wrapper that adds live subscription support to a cache.
 *
 * This enables caches to automatically update when the underlying data changes,
 * which is essential for real-time synchronization with Automerge documents.
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

/**
 * Cache for document snapshots with live subscriptions.
 *
 * This cache stores the current state of documents and automatically
 * subscribes to changes, updating the cache when documents change.
 */
export const documentCache = withLiveSubscription<
  [Repo, AnyDocumentId],
  Doc<unknown> | undefined
>({
  getKey: getDocumentCacheKey,
  getCache: ({ onEviction, getKey, onUpdate }) =>
    createCache({
      async load(params) {
        const [repo, id] = params;
        const maybeHandle = await handleCache.readAsync(repo, id);

        // Handle doesn't exist - document not found
        if (!maybeHandle) {
          return undefined;
        }

        // Capture in a const for closure usage
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
 * Cache for loading multiple documents at once.
 *
 * This cache is optimized for loading arrays of documents in parallel
 * while maintaining subscriptions to each individual document's changes.
 */
export const multipleDocumentCache = withLiveSubscription<
  [Repo, AnyDocumentId[]],
  (Doc<unknown> | undefined)[]
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
