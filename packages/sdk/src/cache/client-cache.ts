/**
 * Client-facing cache utilities that use ITrizumClient.
 *
 * This module provides a clean API for cache operations without exposing
 * the underlying document repository. Internally, it accesses the Repo through
 * the client's internal symbol.
 */

import type { ITrizumClient } from "../client.js";
import type { DocumentId } from "../types.js";
import {
  documentCache,
  multipleDocumentCache,
} from "../internal/document-cache.js";
import type { Repo } from "../internal/crdt.js";
import { INTERNAL_REPO_SYMBOL } from "../internal/symbols.js";

/**
 * Internal type for clients that have access to the internal repo.
 * Both TrizumClient and TrizumWorkerClient have this symbol internally.
 */
type ClientWithRepo = {
  [INTERNAL_REPO_SYMBOL]: Repo;
};

/**
 * Get the internal Repo from a client.
 * This works because both TrizumClient and TrizumWorkerClient have
 * the INTERNAL_REPO_SYMBOL property, even though it's private.
 */
function getRepo(client: ITrizumClient): Repo {
  return (client as unknown as ClientWithRepo)[INTERNAL_REPO_SYMBOL];
}

/**
 * Cache utilities for loading and managing documents.
 *
 * These utilities integrate with React Suspense and automatically
 * subscribe to document changes for real-time updates.
 */
export const cache = {
  /**
   * Read a document from the cache, suspending if not loaded.
   * Use this in React components with Suspense.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID to load
   * @returns The document data or undefined if not found
   */
  read<T>(client: ITrizumClient, id: DocumentId): T | undefined {
    return documentCache.read(getRepo(client), id) as T | undefined;
  },

  /**
   * Read a document asynchronously (returns a Promise).
   * Use this in loaders, effects, or other async contexts.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID to load
   * @returns Promise resolving to the document data or undefined
   */
  async readAsync<T>(
    client: ITrizumClient,
    id: DocumentId,
  ): Promise<T | undefined> {
    return documentCache.readAsync(getRepo(client), id) as Promise<
      T | undefined
    >;
  },

  /**
   * Get a document from cache only if it's already loaded.
   * Returns undefined if the document isn't in the cache.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID
   * @returns The cached document data or undefined
   */
  getIfCached<T>(client: ITrizumClient, id: DocumentId): T | undefined {
    return documentCache.getValueIfCached(getRepo(client), id) as T | undefined;
  },

  /**
   * Prefetch a document into the cache without blocking.
   * Use this to preload documents that will be needed soon.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID to prefetch
   */
  prefetch(client: ITrizumClient, id: DocumentId): void {
    documentCache.prefetch(getRepo(client), id);
  },

  /**
   * Subscribe to cache updates for a document.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID to subscribe to
   * @param callback - Function called when the cache updates
   * @returns Unsubscribe function
   */
  subscribe(
    client: ITrizumClient,
    id: DocumentId,
    callback: () => void,
  ): () => void {
    return documentCache.subscribe(callback, getRepo(client), id);
  },

  /**
   * Evict a document from the cache.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param id - The document ID to evict
   */
  evict(client: ITrizumClient, id: DocumentId): boolean {
    return documentCache.evict(getRepo(client), id);
  },

  /**
   * Clear all documents from the cache.
   */
  evictAll(): void {
    documentCache.evictAll();
  },
};

/**
 * Cache utilities for loading multiple documents at once.
 */
export const multiCache = {
  /**
   * Read multiple documents from the cache, suspending if not loaded.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param ids - Array of document IDs to load
   * @returns Array of document data (undefined for missing documents)
   */
  read<T>(client: ITrizumClient, ids: DocumentId[]): (T | undefined)[] {
    return multipleDocumentCache.read(getRepo(client), ids) as (
      | T
      | undefined
    )[];
  },

  /**
   * Read multiple documents asynchronously.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param ids - Array of document IDs to load
   * @returns Promise resolving to array of documents
   */
  async readAsync<T>(
    client: ITrizumClient,
    ids: DocumentId[],
  ): Promise<(T | undefined)[]> {
    return multipleDocumentCache.readAsync(getRepo(client), ids) as Promise<
      (T | undefined)[]
    >;
  },

  /**
   * Subscribe to cache updates for multiple documents.
   *
   * @param client - The TrizumClient or TrizumWorkerClient instance
   * @param ids - Array of document IDs to subscribe to
   * @param callback - Function called when any document updates
   * @returns Unsubscribe function
   */
  subscribe(
    client: ITrizumClient,
    ids: DocumentId[],
    callback: () => void,
  ): () => void {
    return multipleDocumentCache.subscribe(callback, getRepo(client), ids);
  },
};
