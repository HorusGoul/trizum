import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
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
