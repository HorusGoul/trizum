import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { STATUS_NOT_FOUND, STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createCache } from "./createCache.js";

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
});
