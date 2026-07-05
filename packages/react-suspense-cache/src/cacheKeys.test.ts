import { describe, expect, test } from "vite-plus/test";
import { getDefaultCacheKey } from "./cacheKeys.js";

describe("getDefaultCacheKey", () => {
  test("joins params using their string representation", () => {
    expect(getDefaultCacheKey(["party", 1, true, null, undefined])).toBe(
      "party,1,true,null,undefined",
    );
  });

  test("returns an empty key for empty params", () => {
    expect(getDefaultCacheKey([])).toBe("");
  });
});
