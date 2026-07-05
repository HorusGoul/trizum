import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { STATUS_NOT_FOUND, STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createExternallyManagedCache } from "./createExternallyManagedCache.js";

describe("createExternallyManagedCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("cacheValue resolves pending records", async () => {
    const cache = createExternallyManagedCache<[string], string>({
      getKey: ([id]) => id,
    });
    const subscriber = vi.fn<(data: unknown) => void>();

    cache.subscribe(subscriber, "a");
    const pending = cache.readAsync("a");

    expect(cache.getStatus("a")).toBe(STATUS_PENDING);

    cache.cacheValue("value:a", "a");

    await expect(pending).resolves.toBe("value:a");
    expect(cache.getStatus("a")).toBe(STATUS_RESOLVED);
    expect(cache.getValue("a")).toBe("value:a");
    expect(subscriber).toHaveBeenLastCalledWith({
      status: STATUS_RESOLVED,
      value: "value:a",
    });
  });

  test("cacheError rejects pending records", async () => {
    const cache = createExternallyManagedCache<[string], string>({
      getKey: ([id]) => id,
    });
    const error = new Error("external failure");

    const pending = cache.readAsync("a");
    cache.cacheError(error, "a");

    await expect(pending).rejects.toBe(error);
    expect(cache.getStatus("a")).toBe(STATUS_REJECTED);
    expect(() => cache.getValue("a")).toThrow(error);
  });

  test("cacheValue and cacheError update existing records", () => {
    const cache = createExternallyManagedCache<[string], string>({
      getKey: ([id]) => id,
    });
    const error = new Error("external replacement");

    cache.cacheValue("old:a", "a");
    cache.cacheValue("new:a", "a");

    expect(cache.getStatus("a")).toBe(STATUS_RESOLVED);
    expect(cache.getValue("a")).toBe("new:a");

    cache.cacheError(error, "a");

    expect(cache.getStatus("a")).toBe(STATUS_REJECTED);
    expect(() => cache.getValue("a")).toThrow(error);
  });

  test("delegates the standard cache API", async () => {
    const cache = createExternallyManagedCache<[string], string>({
      getKey: ([id]) => id,
    });
    const subscriber = vi.fn<(data: unknown) => void>();

    cache.cacheValue("value:a", "a");

    expect(cache.read("a")).toBe("value:a");
    await expect(cache.readAsync("a")).resolves.toBe("value:a");
    expect(cache.getValueIfCached("a")).toBe("value:a");

    cache.subscribe(subscriber, "a");
    expect(subscriber).toHaveBeenLastCalledWith({
      status: STATUS_RESOLVED,
      value: "value:a",
    });

    expect(cache.evict("a")).toBe(true);
    expect(cache.getStatus("a")).toBe(STATUS_NOT_FOUND);
    expect(subscriber).toHaveBeenLastCalledWith({ status: STATUS_NOT_FOUND });

    cache.prefetch("pending");

    expect(cache.getStatus("pending")).toBe(STATUS_PENDING);
    expect(cache.abort("pending")).toBe(true);
    expect(cache.getStatus("pending")).toBe(STATUS_NOT_FOUND);

    cache.cacheValue("value:b", "b");
    cache.cacheValue("value:c", "c");
    cache.evictAll();

    expect(cache.getStatus("b")).toBe(STATUS_NOT_FOUND);
    expect(cache.getStatus("c")).toBe(STATUS_NOT_FOUND);
  });

  test("timeout rejects records that are not externally resolved", async () => {
    vi.useFakeTimers();

    const cache = createExternallyManagedCache<[string], string>({
      getKey: ([id]) => id,
      timeout: 100,
      timeoutMessage: "external timeout",
    });
    const pending = cache.readAsync("a");

    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).rejects.toThrow("external timeout");
    expect(cache.getStatus("a")).toBe(STATUS_REJECTED);
  });
});
