import { describe, expect, test } from "vite-plus/test";
import { createDefaultCacheMap, getCacheMapValues } from "./cacheMap.js";
import { createResolvedRecord } from "./records.js";
import type { CacheMap, Record } from "./types.js";

describe("cache map helpers", () => {
  test("creates the default record map", () => {
    const cacheMap = createDefaultCacheMap<string>();
    const record = createResolvedRecord("value");

    cacheMap.set("a", record);

    expect(cacheMap.get("a")).toBe(record);
    expect(cacheMap.has("a")).toBe(true);
  });

  test("reads values from Map-backed caches", () => {
    const cacheMap = new Map<string, Record<string>>();
    const record = createResolvedRecord("value");

    cacheMap.set("a", record);

    expect(getCacheMapValues(cacheMap)).toEqual([record]);
  });

  test("reads values from custom cache maps", () => {
    const cacheMap = new BasicCacheMap<string, Record<string>>();
    const record = createResolvedRecord("value");

    cacheMap.set("a", record);

    expect(getCacheMapValues(cacheMap)).toEqual([record]);
  });
});

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

  values(): Iterable<Value> {
    return this.map.values();
  }
}
