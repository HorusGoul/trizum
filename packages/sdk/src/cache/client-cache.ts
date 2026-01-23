/**
 * Client-facing cache utilities that use TrizumClient instead of Repo.
 *
 * This module provides a clean API for cache operations without exposing
 * the underlying Automerge Repo.
 */

import type { TrizumClient } from "../client.js";
import type { DocumentId } from "../types.js";
import { documentCache, handleCache, multipleDocumentCache } from "./document-cache.js";

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
   * @param client - The TrizumClient instance
   * @param id - The document ID to load
   * @returns The document data or undefined if not found
   */
  read<T>(client: TrizumClient, id: DocumentId): T | undefined {
    return documentCache.read(client._internalRepo, id) as T | undefined;
  },

  /**
   * Read a document asynchronously (returns a Promise).
   * Use this in loaders, effects, or other async contexts.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID to load
   * @returns Promise resolving to the document data or undefined
   */
  async readAsync<T>(client: TrizumClient, id: DocumentId): Promise<T | undefined> {
    return documentCache.readAsync(client._internalRepo, id) as Promise<T | undefined>;
  },

  /**
   * Get a document from cache only if it's already loaded.
   * Returns undefined if the document isn't in the cache.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID
   * @returns The cached document data or undefined
   */
  getIfCached<T>(client: TrizumClient, id: DocumentId): T | undefined {
    return documentCache.getValueIfCached(client._internalRepo, id) as T | undefined;
  },

  /**
   * Prefetch a document into the cache without blocking.
   * Use this to preload documents that will be needed soon.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID to prefetch
   */
  prefetch(client: TrizumClient, id: DocumentId): void {
    documentCache.prefetch(client._internalRepo, id);
  },

  /**
   * Subscribe to cache updates for a document.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID to subscribe to
   * @param callback - Function called when the cache updates
   * @returns Unsubscribe function
   */
  subscribe(client: TrizumClient, id: DocumentId, callback: () => void): () => void {
    return documentCache.subscribe(callback, client._internalRepo, id);
  },

  /**
   * Evict a document from the cache.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID to evict
   */
  evict(client: TrizumClient, id: DocumentId): boolean {
    return documentCache.evict(client._internalRepo, id);
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
   * @param client - The TrizumClient instance
   * @param ids - Array of document IDs to load
   * @returns Array of document data (undefined for missing documents)
   */
  read<T>(client: TrizumClient, ids: DocumentId[]): (T | undefined)[] {
    return multipleDocumentCache.read(client._internalRepo, ids) as (T | undefined)[];
  },

  /**
   * Read multiple documents asynchronously.
   *
   * @param client - The TrizumClient instance
   * @param ids - Array of document IDs to load
   * @returns Promise resolving to array of documents
   */
  async readAsync<T>(client: TrizumClient, ids: DocumentId[]): Promise<(T | undefined)[]> {
    return multipleDocumentCache.readAsync(client._internalRepo, ids) as Promise<(T | undefined)[]>;
  },

  /**
   * Subscribe to cache updates for multiple documents.
   *
   * @param client - The TrizumClient instance
   * @param ids - Array of document IDs to subscribe to
   * @param callback - Function called when any document updates
   * @returns Unsubscribe function
   */
  subscribe(client: TrizumClient, ids: DocumentId[], callback: () => void): () => void {
    return multipleDocumentCache.subscribe(callback, client._internalRepo, ids);
  },
};

/**
 * Cache utilities for document handles.
 */
export const handleCacheUtils = {
  /**
   * Read a document handle from the cache, suspending if not loaded.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID
   * @returns The handle or undefined
   */
  read(client: TrizumClient, id: DocumentId) {
    return handleCache.read(client._internalRepo, id);
  },

  /**
   * Read a document handle asynchronously.
   *
   * @param client - The TrizumClient instance
   * @param id - The document ID
   * @returns Promise resolving to the handle or undefined
   */
  async readAsync(client: TrizumClient, id: DocumentId) {
    return handleCache.readAsync(client._internalRepo, id);
  },
};
