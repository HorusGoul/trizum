import { createCache } from "./createCache.js";
import { isPendingRecord, updateRecordToRejected, updateRecordToResolved } from "./records.js";
import type {
  Cache,
  CreateCacheOptions,
  ExternallyManagedCache,
  InternalCache,
  Record,
} from "./types.js";

export function createExternallyManagedCache<Params extends Array<any>, Value>(
  options: Omit<CreateCacheOptions<Params, Value>, "load"> & {
    timeout?: number;
    timeoutMessage?: string;
  },
): ExternallyManagedCache<Params, Value> {
  const { timeout, timeoutMessage = "Timed out", ...rest } = options;
  const decoratedCache = createCache<Params, Value>({
    ...rest,
    load: (_params, loadOptions) =>
      new Promise<Value>((_resolve, reject) => {
        if (timeout == null) {
          return;
        }

        setTimeout(() => {
          if (!loadOptions.signal.aborted) {
            reject(new Error(timeoutMessage));
          }
        }, timeout);
      }),
  });
  const { __getKey, __getOrCreateRecord, __notifySubscribers, __recordMap } =
    decoratedCache as InternalCache<Params, Value>;
  const api: Omit<Cache<Params, Value>, "cache"> = {
    abort: (...params) => decoratedCache.abort(...params),
    evict: (...params) => decoratedCache.evict(...params),
    evictAll: () => decoratedCache.evictAll(),
    getStatus: (...params) => decoratedCache.getStatus(...params),
    getValue: (...params) => decoratedCache.getValue(...params),
    getValueIfCached: (...params) => decoratedCache.getValueIfCached(...params),
    prefetch: (...params) => decoratedCache.prefetch(...params),
    read: (...params) => decoratedCache.read(...params),
    readAsync: (...params) => decoratedCache.readAsync(...params),
    subscribe: (callback, ...params) => decoratedCache.subscribe(callback, ...params),
  };

  return {
    ...api,
    cacheError(error, ...params) {
      const key = __getKey(params);
      const record = __getOrCreateRecord(...params);

      if (isPendingRecord(record)) {
        const { abortController } = record.data;

        abortController.abort();
        updateRecordToRejected(record, error);
      } else {
        updateRecordToRejected(record as Record<Value>, error);
      }

      __recordMap.set(key, record);
      __notifySubscribers(params);
    },
    cacheValue(value, ...params) {
      const key = __getKey(params);
      const record = __getOrCreateRecord(...params);

      if (isPendingRecord(record)) {
        const { abortController } = record.data;

        abortController.abort();
        updateRecordToResolved(record, value);
      } else {
        updateRecordToResolved(record as Record<Value>, value);
      }

      __recordMap.set(key, record);
      __notifySubscribers(params);
    },
  };
}
