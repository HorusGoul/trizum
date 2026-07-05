import type { CacheMap, Record } from "./types.js";

export function createDefaultCacheMap<Value>(): CacheMap<string, Record<Value>> {
  return new Map<string, Record<Value>>();
}

export function getCacheMapValues<Value>(
  cacheMap: CacheMap<string, Record<Value>>,
): Record<Value>[] {
  if (cacheMap instanceof Map) {
    return Array.from(cacheMap.values());
  }

  return [];
}
