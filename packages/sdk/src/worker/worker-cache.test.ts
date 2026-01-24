/**
 * Tests for WorkerCache.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkerCache } from "./worker-cache.js";

// Mock the CRDT module
vi.mock("../internal/crdt.js", () => ({
  toAMDocumentId: (id: string) => id,
}));

// Create a mock Repo
function createMockRepo() {
  const handles = new Map<
    string,
    {
      doc: () => unknown;
      isDeleted: () => boolean;
      on: (event: string, cb: () => void) => void;
      off: (event: string, cb: () => void) => void;
      changeListeners: Set<() => void>;
      deleteListeners: Set<() => void>;
    }
  >();

  return {
    find: vi.fn(async (id: string) => {
      if (!handles.has(id)) {
        const changeListeners = new Set<() => void>();
        const deleteListeners = new Set<() => void>();
        handles.set(id, {
          doc: () => ({ id, data: `data-${id}` }),
          isDeleted: () => false,
          on: (event: string, cb: () => void) => {
            if (event === "change") changeListeners.add(cb);
            if (event === "delete") deleteListeners.add(cb);
          },
          off: (event: string, cb: () => void) => {
            if (event === "change") changeListeners.delete(cb);
            if (event === "delete") deleteListeners.delete(cb);
          },
          changeListeners,
          deleteListeners,
        });
      }
      return handles.get(id)!;
    }),
    handles,
  };
}

describe("WorkerCache", () => {
  let mockRepo: ReturnType<typeof createMockRepo>;
  let cache: WorkerCache;

  beforeEach(() => {
    mockRepo = createMockRepo();
    cache = new WorkerCache(mockRepo as never);
  });

  describe("get", () => {
    it("should load and cache a document", async () => {
      const doc = await cache.get("doc1");

      expect(doc).toEqual({ id: "doc1", data: "data-doc1" });
      expect(mockRepo.find).toHaveBeenCalledWith("doc1", {
        allowableStates: ["ready"],
      });
      expect(cache.has("doc1")).toBe(true);
    });

    it("should return cached document on subsequent calls", async () => {
      await cache.get("doc1");
      await cache.get("doc1");

      // Should only call find once
      expect(mockRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe("getIfCached", () => {
    it("should return undefined for uncached documents", () => {
      const doc = cache.getIfCached("doc1");
      expect(doc).toBeUndefined();
    });

    it("should return cached document", async () => {
      await cache.get("doc1");
      const doc = cache.getIfCached("doc1");
      expect(doc).toEqual({ id: "doc1", data: "data-doc1" });
    });
  });

  describe("has", () => {
    it("should return false for uncached documents", () => {
      expect(cache.has("doc1")).toBe(false);
    });

    it("should return true for cached documents", async () => {
      await cache.get("doc1");
      expect(cache.has("doc1")).toBe(true);
    });
  });

  describe("prefetch", () => {
    it("should load multiple documents", async () => {
      await cache.prefetch(["doc1", "doc2", "doc3"]);

      expect(cache.has("doc1")).toBe(true);
      expect(cache.has("doc2")).toBe(true);
      expect(cache.has("doc3")).toBe(true);
      expect(cache.size).toBe(3);
    });
  });

  describe("evict", () => {
    it("should remove document from cache", async () => {
      await cache.get("doc1");
      expect(cache.has("doc1")).toBe(true);

      const evicted = cache.evict("doc1");

      expect(evicted).toBe(true);
      expect(cache.has("doc1")).toBe(false);
    });

    it("should return false for uncached documents", () => {
      const evicted = cache.evict("doc1");
      expect(evicted).toBe(false);
    });
  });

  describe("evictAll", () => {
    it("should remove all documents from cache", async () => {
      await cache.prefetch(["doc1", "doc2", "doc3"]);
      expect(cache.size).toBe(3);

      cache.evictAll();

      expect(cache.size).toBe(0);
      expect(cache.has("doc1")).toBe(false);
      expect(cache.has("doc2")).toBe(false);
      expect(cache.has("doc3")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return the number of cached documents", async () => {
      expect(cache.size).toBe(0);

      await cache.get("doc1");
      expect(cache.size).toBe(1);

      await cache.get("doc2");
      expect(cache.size).toBe(2);

      cache.evict("doc1");
      expect(cache.size).toBe(1);
    });
  });

  describe("keys", () => {
    it("should return all cached document IDs", async () => {
      await cache.prefetch(["doc1", "doc2"]);

      const keys = cache.keys();
      expect(keys).toContain("doc1");
      expect(keys).toContain("doc2");
      expect(keys.length).toBe(2);
    });
  });
});
