import type { CacheMap, Record } from "./types.js";

export function createDefaultCacheMap<Value>(): CacheMap<string, Record<Value>> {
  return new Map<string, Record<Value>>();
}

export function getCacheMapValues<Value>(
  cacheMap: CacheMap<string, Record<Value>>,
): Record<Value>[] {
  return Array.from(cacheMap.values());
}
