import { describe, expect, test } from "vite-plus/test";
import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createDeferred } from "./deferred.js";

describe("createDeferred", () => {
  test("resolves once and tracks status", async () => {
    const deferred = createDeferred<string>("test deferred");

    expect(deferred.debugLabel).toBe("test deferred");
    expect(deferred.status).toBe(STATUS_PENDING);
    expect(deferred.promise.status).toBe(STATUS_PENDING);
    expect(deferred.promise.value).toBeUndefined();
    expect(deferred.promise.reason).toBeUndefined();

    deferred.resolve("value");

    await expect(deferred.promise).resolves.toBe("value");
    expect(deferred.status).toBe(STATUS_RESOLVED);
    expect(deferred.promise.status).toBe("fulfilled");
    expect(deferred.promise.value).toBe("value");
    expect(deferred.promise.reason).toBeUndefined();
    expect(() => deferred.resolve("next")).toThrow("Deferred has already been resolved");
  });

  test("rejects once and tracks status", async () => {
    const error = new Error("failed");
    const deferred = createDeferred<string>();

    deferred.reject(error);

    await expect(deferred.promise).rejects.toBe(error);
    expect(deferred.status).toBe(STATUS_REJECTED);
    expect(deferred.promise.status).toBe(STATUS_REJECTED);
    expect(deferred.promise.value).toBeUndefined();
    expect(deferred.promise.reason).toBe(error);
    expect(() => deferred.reject(new Error("next"))).toThrow("Deferred has already been rejected");
  });
});
