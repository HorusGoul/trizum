/**
 * Worker-side in-memory cache for documents.
 *
 * This cache lives in the Web Worker thread, providing fast access to
 * document snapshots without hitting IndexedDB. It automatically
 * subscribes to document changes and keeps the cache up-to-date.
 *
 * Architecture:
 * - Worker Cache: In-memory cache close to storage (IndexedDB)
 * - UI Cache: React Suspense cache in main thread (for React integration)
 *
 * The worker cache reduces IndexedDB reads and speeds up document access
 * when the main thread requests documents via MessageChannel.
 */

import type { Repo, AMDocHandle } from "../internal/crdt.js";
import { toAMDocumentId } from "../internal/crdt.js";
import type { AnyDocumentId } from "../types.js";

interface CacheEntry<T = unknown> {
  /** The cached document snapshot */
  doc: T | undefined;
  /** The document handle for subscriptions */
  handle: AMDocHandle<T>;
  /** Cleanup function to unsubscribe */
  cleanup: () => void;
}

/**
 * Worker-side document cache.
 *
 * Provides in-memory caching of documents with automatic updates
 * when documents change. This cache is designed to run in a Web Worker
 * thread alongside the Automerge Repo.
 */
export class WorkerCache {
  private cache = new Map<string, CacheEntry>();
  private repo: Repo;

  constructor(repo: Repo) {
    this.repo = repo;
  }

  /**
   * Get a document from cache, loading it if necessary.
   * Returns the cached snapshot or undefined if the document doesn't exist.
   */
  async get<T>(id: AnyDocumentId): Promise<T | undefined> {
    const key = String(id);
    const existing = this.cache.get(key);

    if (existing) {
      return existing.doc as T | undefined;
    }

    // Load and cache the document
    return this.load<T>(id);
  }

  /**
   * Get a document from cache only if it's already loaded.
   * Does not trigger a load if the document isn't cached.
   */
  getIfCached<T>(id: AnyDocumentId): T | undefined {
    const key = String(id);
    const entry = this.cache.get(key);
    return entry?.doc as T | undefined;
  }

  /**
   * Check if a document is in the cache.
   */
  has(id: AnyDocumentId): boolean {
    return this.cache.has(String(id));
  }

  /**
   * Load a document into the cache.
   * Sets up subscriptions for automatic updates.
   */
  async load<T>(id: AnyDocumentId): Promise<T | undefined> {
    const key = String(id);

    // Check if already loading/loaded
    if (this.cache.has(key)) {
      return this.cache.get(key)!.doc as T | undefined;
    }

    try {
      const amId = toAMDocumentId(id);
      const handle = await this.repo.find<T>(amId, {
        allowableStates: ["ready"],
      });

      if (handle.isDeleted()) {
        return undefined;
      }

      // Set up change subscription
      const onChange = () => {
        const entry = this.cache.get(key);
        if (entry) {
          entry.doc = handle.doc();
        }
      };

      const onDelete = () => {
        const entry = this.cache.get(key);
        if (entry) {
          entry.doc = undefined;
        }
      };

      handle.on("change", onChange);
      handle.on("delete", onDelete);

      const cleanup = () => {
        handle.off("change", onChange);
        handle.off("delete", onDelete);
      };

      const entry: CacheEntry<T> = {
        doc: handle.doc(),
        handle: handle,
        cleanup,
      };

      this.cache.set(key, entry as CacheEntry);

      return entry.doc;
    } catch {
      return undefined;
    }
  }

  /**
   * Prefetch multiple documents into the cache.
   * Useful for warming the cache with documents that will be needed soon.
   */
  async prefetch(ids: AnyDocumentId[]): Promise<void> {
    await Promise.all(ids.map((id) => this.load(id)));
  }

  /**
   * Evict a document from the cache.
   * Cleans up subscriptions.
   */
  evict(id: AnyDocumentId): boolean {
    const key = String(id);
    const entry = this.cache.get(key);

    if (entry) {
      entry.cleanup();
      this.cache.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Evict all documents from the cache.
   * Cleans up all subscriptions.
   */
  evictAll(): void {
    for (const entry of this.cache.values()) {
      entry.cleanup();
    }
    this.cache.clear();
  }

  /**
   * Get the number of cached documents.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached document IDs.
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}
