import { describe, expect, test } from "vite-plus/test";
import { isPromiseLike } from "./promise.js";

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
});
