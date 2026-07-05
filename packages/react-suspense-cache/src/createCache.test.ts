import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
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
