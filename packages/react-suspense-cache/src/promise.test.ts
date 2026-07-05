import { describe, expect, test } from "vite-plus/test";
import {
  createFulfilledReactPromise,
  createRejectedReactPromise,
  isPromiseLike,
  markReactPromiseFulfilled,
  markReactPromisePending,
  markReactPromiseRejected,
} from "./promise.js";
import type { ReactUsePromise } from "./types.js";

describe("isPromiseLike", () => {
  test("detects promises and thenables", () => {
    expect(isPromiseLike(Promise.resolve("value"))).toBe(true);
    expect(isPromiseLike({ then() {} })).toBe(true);
  });

  test("rejects plain values and non-callable then properties", () => {
    expect(isPromiseLike("value")).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike({ then: "not a function" })).toBe(false);
  });

  test("marks React promise status fields", () => {
    const promise = Promise.resolve("initial") as ReactUsePromise<string>;
    const error = new Error("failed");

    markReactPromisePending(promise);

    expect(promise).toMatchObject({ status: "pending" });
    expect(promise).not.toHaveProperty("value");
    expect(promise).not.toHaveProperty("reason");

    markReactPromiseFulfilled(promise, "value");

    expect(promise).toMatchObject({
      status: "fulfilled",
      value: "value",
    });
    expect(promise).not.toHaveProperty("reason");

    markReactPromiseRejected(promise, error);

    expect(promise).toMatchObject({
      reason: error,
      status: "rejected",
    });
    expect(promise).not.toHaveProperty("value");
  });

  test("creates fulfilled and rejected React promises", async () => {
    const error = new Error("failed");
    const fulfilledPromise = createFulfilledReactPromise("value");
    const rejectedPromise = createRejectedReactPromise(error);

    await expect(fulfilledPromise).resolves.toBe("value");
    await expect(rejectedPromise).rejects.toBe(error);
    expect(fulfilledPromise).toMatchObject({
      status: "fulfilled",
      value: "value",
    });
    expect(rejectedPromise).toMatchObject({
      reason: error,
      status: "rejected",
    });
  });
});
