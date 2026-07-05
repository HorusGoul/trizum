import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { resetSync, type LogRecord, type Sink } from "@logtape/logtape";
import { configureTrizumLogging } from "@trizum/logging";
import {
  STATUS_ABORTED,
  STATUS_NOT_FOUND,
  STATUS_PENDING,
  STATUS_REJECTED,
  STATUS_RESOLVED,
} from "./constants.js";
import { createCache } from "./createCache.js";
import type { CacheMap, Record } from "./types.js";

describe("createCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSync();
  });

  afterEach(() => {
    resetSync();
  });

  test("loads values once per cache key", async () => {
    const load = vi.fn<(params: [string]) => Promise<string>>(
      async ([id]: [string]) => `value:${id}`,
    );
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load,
    });

    const pending = cache.readAsync("a");

    expect(cache.getStatus("a")).toBe(STATUS_PENDING);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBe("value:a");
    expect(cache.getStatus("a")).toBe(STATUS_RESOLVED);
    expect(cache.readAsync("a")).toBe("value:a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("uses the default key and supports synchronous loads", () => {
    const load = vi.fn<(params: [number, string]) => string>(
      ([count, id]) => `value:${count}:${id}`,
    );
    const cache = createCache<[number, string], string>({ load });

    expect(cache.readAsync(1, "a")).toBe("value:1:a");
    expect(cache.readAsync(1, "a")).toBe("value:1:a");
    expect(cache.readAsync(1, "b")).toBe("value:1:b");
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("writes debug logs through trizum logging", () => {
    const logs = createRecordingSink();
    const cache = createCache<[string], string>({
      debugLabel: "test-cache",
      getKey: ([id]) => `secret-key:${id}`,
      load: ([id]) => `value:${id}`,
    });

    configureTrizumLogging({
      extraSinks: { test: logs.sink },
      lowestLevel: "debug",
      reset: true,
      surface: "react-suspense-cache",
      surfaceSinks: ["test"],
    });

    cache.readAsync("a");
    cache.evict("a");
    cache.evict("missing");

    expect(logs.records).toHaveLength(4);
    expect(logs.records.map((record) => record.properties.operation)).toEqual([
      "read-miss",
      "load-resolved",
      "evict",
      "evict",
    ]);
    expect(logs.records[0]).toMatchObject({
      category: ["trizum", "react-suspense-cache", "createCache"],
      level: "debug",
      properties: {
        cacheLabel: "test-cache",
        operation: "read-miss",
        paramsCount: 1,
      },
    });
    expect(logs.records.map((record) => record.properties)).not.toContainEqual(
      expect.objectContaining({
        cacheKey: expect.anything(),
        params: expect.anything(),
      }),
    );
    expect(JSON.stringify(logs.records.map((record) => record.properties))).not.toContain(
      "secret-key:a",
    );
    expect(JSON.stringify(logs.records.map((record) => record.properties))).not.toContain('"a"');
  });

  test("read returns resolved values", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });

    await cache.readAsync("a");
    expect(cache.read("a")).toBe("value:a");
  });

  test("notifies subscribers when cache records change", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });
    const subscriber = vi.fn<(data: unknown) => void>();
    const unsubscribe = cache.subscribe(subscriber, "a");

    expect(subscriber).toHaveBeenLastCalledWith({ status: STATUS_NOT_FOUND });

    const pending = cache.readAsync("a");

    expect(subscriber).toHaveBeenLastCalledWith({ status: STATUS_PENDING });
    await pending;
    expect(subscriber).toHaveBeenLastCalledWith({
      status: STATUS_RESOLVED,
      value: "value:a",
    });

    cache.cache("next:a", "a");

    expect(subscriber).toHaveBeenLastCalledWith({
      status: STATUS_RESOLVED,
      value: "next:a",
    });

    unsubscribe();
    cache.cache("ignored:a", "a");
    expect(subscriber).toHaveBeenCalledTimes(4);
  });

  test("cache resolves a pending record and aborts the stale load", async () => {
    let signal: AbortSignal | undefined;
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: (_params, loadOptions) => {
        signal = loadOptions.signal;
        return new Promise<string>(() => {});
      },
    });

    const pending = cache.readAsync("a");

    expect(cache.getStatus("a")).toBe(STATUS_PENDING);

    cache.cache("manual:a", "a");

    await expect(pending).resolves.toBe("manual:a");
    expect(signal?.aborted).toBe(true);
    expect(cache.getStatus("a")).toBe(STATUS_RESOLVED);
    expect(cache.getValue("a")).toBe("manual:a");
  });

  test("aborts pending records", () => {
    let signal: AbortSignal | undefined;
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: (_params, loadOptions) => {
        signal = loadOptions.signal;
        return new Promise<string>(() => {});
      },
    });
    const subscriber = vi.fn<(data: unknown) => void>();

    cache.subscribe(subscriber, "a");
    cache.readAsync("a");

    expect(cache.abort("a")).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(cache.getStatus("a")).toBe(STATUS_NOT_FOUND);
    expect(subscriber).toHaveBeenLastCalledWith({ status: STATUS_ABORTED });
    expect(cache.abort("a")).toBe(false);
  });

  test("prefetch starts loads and suppresses cached read errors", async () => {
    const error = new Error("prefetch failed");
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async () => {
        throw error;
      },
    });

    cache.prefetch("a");

    await expect(cache.readAsync("a")).rejects.toBe(error);
    expect(() => cache.prefetch("a")).not.toThrow();
  });

  test("stores rejected records", async () => {
    const thrown = new Error("nope");
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async () => {
        throw thrown;
      },
    });

    await expect(cache.readAsync("a")).rejects.toBe(thrown);
    expect(cache.getStatus("a")).toBe(STATUS_REJECTED);
    expect(() => cache.getValue("a")).toThrow(thrown);
  });

  test("throws clear errors when reading missing or pending values imperatively", () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: () => new Promise<string>(() => {}),
    });

    expect(cache.getValueIfCached("a")).toBeUndefined();
    expect(() => cache.getValue("a")).toThrow("No record found");

    cache.readAsync("a");

    expect(cache.getValueIfCached("a")).toBeUndefined();
    expect(() => cache.getValue("a")).toThrow('Record found with status "pending"');
  });

  test("evicts records", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });

    await cache.readAsync("a");

    expect(cache.getValueIfCached("a")).toBe("value:a");
    expect(cache.evict("a")).toBe(true);
    expect(cache.getStatus("a")).toBe(STATUS_NOT_FOUND);
  });

  test("evicts all records and clears subscribers", async () => {
    let signal: AbortSignal | undefined;
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: ([id], loadOptions) => {
        signal = loadOptions.signal;
        return id === "pending" ? new Promise<string>(() => {}) : `value:${id}`;
      },
    });
    const resolvedSubscriber = vi.fn<(data: unknown) => void>();
    const pendingSubscriber = vi.fn<(data: unknown) => void>();

    cache.subscribe(resolvedSubscriber, "resolved");
    cache.subscribe(pendingSubscriber, "pending");

    cache.readAsync("resolved");
    cache.readAsync("pending");

    expect(cache.getStatus("resolved")).toBe(STATUS_RESOLVED);
    expect(cache.getStatus("pending")).toBe(STATUS_PENDING);

    cache.evictAll();

    expect(signal?.aborted).toBe(true);
    expect(cache.getStatus("resolved")).toBe(STATUS_NOT_FOUND);
    expect(cache.getStatus("pending")).toBe(STATUS_NOT_FOUND);
    expect(resolvedSubscriber).toHaveBeenLastCalledWith({ status: STATUS_NOT_FOUND });
    expect(pendingSubscriber).toHaveBeenLastCalledWith({ status: STATUS_NOT_FOUND });

    cache.cache("ignored", "resolved");
    expect(resolvedSubscriber).toHaveBeenCalledTimes(4);
  });

  test("supports evictAll with non-Map cache implementations", () => {
    let backingCache: BasicCacheMap<string, Record<string>> | undefined;
    const cache = createCache<[string], string>({
      config: {
        getCache() {
          backingCache = new BasicCacheMap();
          return backingCache;
        },
      },
      getKey: ([id]) => id,
      load: () => new Promise<string>(() => {}),
    });

    cache.readAsync("a");

    expect(backingCache?.has("a")).toBe(true);

    cache.evictAll();

    expect(backingCache?.has("a")).toBe(false);
    expect(cache.getStatus("a")).toBe(STATUS_NOT_FOUND);
  });

  test("notifies subscribers when an external cache evicts a record", () => {
    let backingCache: EvictingCacheMap<string, Record<string>> | undefined;
    const cache = createCache<[string], string>({
      config: {
        getCache(onEviction) {
          backingCache = new EvictingCacheMap(onEviction);
          return backingCache;
        },
      },
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });
    const subscriber = vi.fn<(data: unknown) => void>();

    cache.cache("value:a", "a");
    cache.subscribe(subscriber, "a");

    expect(subscriber).toHaveBeenLastCalledWith({
      status: STATUS_RESOLVED,
      value: "value:a",
    });

    backingCache?.delete("a");

    expect(subscriber).toHaveBeenLastCalledWith({ status: STATUS_NOT_FOUND });
  });

  test("ignores external cache evictions with no subscribers", () => {
    let backingCache: EvictingCacheMap<string, Record<string>> | undefined;
    const cache = createCache<[string], string>({
      config: {
        getCache(onEviction) {
          backingCache = new EvictingCacheMap(onEviction);
          return backingCache;
        },
      },
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });

    cache.cache("value:a", "a");

    expect(() => backingCache?.delete("a")).not.toThrow();
  });

  test("ignores stale load resolutions after a pending record is manually cached", async () => {
    const deferred = createTestDeferred<string>();
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: () => deferred.promise,
    });
    const pending = cache.readAsync("a");

    cache.cache("manual:a", "a");

    await expect(pending).resolves.toBe("manual:a");

    await deferred.settle("stale:a");

    expect(cache.getValue("a")).toBe("manual:a");
  });

  test("ignores stale load rejections after eviction", async () => {
    const deferred = createTestDeferred<string>();
    const error = new Error("stale failure");
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: () => deferred.promise,
    });

    cache.readAsync("a");
    cache.evict("a");
    await deferred.settle(error, true);

    expect(cache.getStatus("a")).toBe(STATUS_NOT_FOUND);
  });
});

class EvictingCacheMap<Key, Value> extends Map<Key, Value> implements CacheMap<Key, Value> {
  constructor(private readonly onEviction: (key: string) => void) {
    super();
  }

  override delete(key: Key): boolean {
    const didDelete = super.delete(key);

    if (didDelete) {
      this.onEviction(String(key));
    }

    return didDelete;
  }
}

class BasicCacheMap<Key, Value> implements CacheMap<Key, Value> {
  private readonly map = new Map<Key, Value>();

  clear(): void {
    this.map.clear();
  }

  delete(key: Key): boolean {
    return this.map.delete(key);
  }

  get(key: Key): Value | undefined {
    return this.map.get(key);
  }

  has(key: Key): boolean {
    return this.map.has(key);
  }

  set(key: Key, value: Value): this {
    this.map.set(key, value);
    return this;
  }
}

function createTestDeferred<Value>() {
  let rejectPromise: (error: unknown) => void = () => {};
  let resolvePromise: (value: Value) => void = () => {};
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  promise.catch(() => {});

  return {
    promise,
    async settle(valueOrError: unknown, reject = false) {
      if (reject) {
        rejectPromise(valueOrError);
      } else {
        resolvePromise(valueOrError as Value);
      }

      try {
        await promise;
      } catch {
        // The cache intentionally ignores stale rejections after eviction.
      }
    },
  };
}

function createRecordingSink() {
  const records: LogRecord[] = [];
  const sink: Sink = (record) => {
    records.push(record);
  };

  return { records, sink };
}
