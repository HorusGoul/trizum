import {
  STATUS_ABORTED,
  STATUS_NOT_FOUND,
  STATUS_PENDING,
  STATUS_REJECTED,
  STATUS_RESOLVED,
} from "./constants.js";
import { createDefaultCacheMap, getCacheMapValues } from "./cacheMap.js";
import { getDefaultCacheKey } from "./cacheKeys.js";
import { createDeferred } from "./deferred.js";
import { getLogger } from "./log.js";
import { isPromiseLike } from "./promise.js";
import {
  createPendingRecord,
  createResolvedRecord,
  isPendingRecord,
  isRejectedRecord,
  isResolvedRecord,
  updateRecordToRejected,
  updateRecordToResolved,
} from "./records.js";
import type {
  Cache,
  CreateCacheOptions,
  InternalCache,
  PendingRecord,
  Record as CacheRecord,
  Status,
  SubscriptionCallback,
  SubscriptionData,
  UnsubscribeCallback,
} from "./types.js";

const logger = getLogger("createCache");

function createInvalidatedPendingRecordError(operation: string): Error {
  const error = new Error(`Cache entry was ${operation}`);

  error.name = "AbortError";

  return error;
}

export function createCache<Params extends Array<any>, Value>(
  options: CreateCacheOptions<Params, Value>,
): Cache<Params, Value> {
  let { config = {}, debugLabel, getKey = getDefaultCacheKey, load } = options;
  const { getCache = createDefaultCacheMap } = config;
  const recordMap = getCache(onExternalCacheEviction);
  const subscriberMap = new Map<string, Set<SubscriptionCallback<Value>>>();

  function debugLog(operation: string, properties: Record<string, unknown> = {}) {
    logger.debug("React suspense cache {operation}", {
      ...(debugLabel ? { cacheLabel: debugLabel } : {}),
      operation,
      ...properties,
    });
  }

  function abort(...params: Params): boolean {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    if (!record || !isPendingRecord(record)) {
      return false;
    }

    debugLog("abort", { paramsCount: params.length });
    rejectPendingRecord(record, createInvalidatedPendingRecordError("aborted"));
    recordMap.delete(cacheKey);
    notifySubscribers(params, { status: STATUS_ABORTED });

    return true;
  }

  function cache(value: Value, ...params: Params): void {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    debugLog("cache", {
      paramsCount: params.length,
      previousStatus: record?.data.status ?? STATUS_NOT_FOUND,
    });

    if (record && isPendingRecord(record)) {
      const { abortController } = record.data;

      abortController.abort();
      updateRecordToResolved(record, value);
      recordMap.set(cacheKey, record);
    } else {
      recordMap.set(cacheKey, createResolvedRecord(value));
    }

    notifySubscribers(params, {
      status: STATUS_RESOLVED,
      value,
    });
  }

  function evict(...params: Params): boolean {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    debugLog("evict", {
      paramsCount: params.length,
      previousStatus: record?.data.status ?? STATUS_NOT_FOUND,
    });

    if (record && isPendingRecord(record)) {
      rejectPendingRecord(record, createInvalidatedPendingRecordError("evicted"));
    }

    const didDelete = recordMap.delete(cacheKey);
    notifySubscribers(params, { status: STATUS_NOT_FOUND });

    return didDelete;
  }

  function evictAll(): void {
    debugLog("evictAll", { subscriberCount: subscriberMap.size });

    for (const record of getCacheMapValues(recordMap)) {
      if (isPendingRecord(record)) {
        rejectPendingRecord(record, createInvalidatedPendingRecordError("evicted"));
      }
    }

    recordMap.clear();

    for (const set of subscriberMap.values()) {
      for (const callback of set) {
        callback({ status: STATUS_NOT_FOUND });
      }
    }

    subscriberMap.clear();
  }

  function getRecord(...params: Params): CacheRecord<Value> | undefined {
    return recordMap.get(getKey(params));
  }

  function getOrCreateRecord(...params: Params): CacheRecord<Value> {
    const cacheKey = getKey(params);
    let record = recordMap.get(cacheKey);

    if (record) {
      debugLog("read-hit", {
        paramsCount: params.length,
        status: record.data.status,
      });
      return record;
    }

    debugLog("read-miss", { paramsCount: params.length });

    const abortController = new AbortController();
    const deferred = createDeferred<Value>(debugLabel ? `${debugLabel} ${cacheKey}` : cacheKey);

    record = createPendingRecord(deferred, abortController);
    recordMap.set(cacheKey, record);
    notifySubscribers(params, { status: STATUS_PENDING });
    void processPendingRecord(abortController, record, ...params);

    return record;
  }

  function getStatus(...params: Params): Status {
    const record = getRecord(...params);

    if (!record) {
      return STATUS_NOT_FOUND;
    }

    return record.data.status;
  }

  function getValue(...params: Params): Value {
    const record = getRecord(...params);

    if (!record) {
      throw new Error("No record found");
    }

    if (isResolvedRecord(record)) {
      return record.data.value;
    }

    if (isRejectedRecord(record)) {
      throw record.data.error;
    }

    throw new Error(`Record found with status "${record.data.status}"`);
  }

  function getValueIfCached(...params: Params): Value | undefined {
    const record = getRecord(...params);

    if (record && isResolvedRecord(record)) {
      return record.data.value;
    }
  }

  function prefetch(...params: Params): void {
    readAsync(...params).then(
      () => {},
      () => {},
    );
  }

  function read(...params: Params): Value {
    const record = getOrCreateRecord(...params);

    if (isResolvedRecord(record)) {
      return record.data.value;
    }

    if (isRejectedRecord(record)) {
      throw record.data.error;
    }

    throw new Error(`Record found with status "${record.data.status}"`);
  }

  function readAsync(...params: Params) {
    const record = getOrCreateRecord(...params);

    return record.data.promise;
  }

  function subscribe(
    callback: SubscriptionCallback<Value>,
    ...params: Params
  ): UnsubscribeCallback {
    const cacheKey = getKey(params);
    const set = subscriberMap.get(cacheKey) ?? new Set<SubscriptionCallback<Value>>();

    set.add(callback);
    subscriberMap.set(cacheKey, set);
    callback(getSubscriptionData(params));

    return () => {
      set.delete(callback);

      if (set.size === 0) {
        subscriberMap.delete(cacheKey);
      }
    };
  }

  function getSubscriptionData(params: Params): SubscriptionData<Value> {
    const record = getRecord(...params);

    if (!record) {
      return { status: STATUS_NOT_FOUND };
    }

    if (isPendingRecord(record)) {
      return { status: STATUS_PENDING };
    }

    if (isResolvedRecord(record)) {
      return {
        status: STATUS_RESOLVED,
        value: record.data.value,
      };
    }

    return {
      error: record.data.error,
      status: STATUS_REJECTED,
    };
  }

  function notifySubscribers(params: Params, data?: SubscriptionData<Value>): void {
    const set = subscriberMap.get(getKey(params));

    if (!set) {
      return;
    }

    const subscriptionData = data ?? getSubscriptionData(params);

    for (const callback of set) {
      callback(subscriptionData);
    }
  }

  function rejectPendingRecord(record: PendingRecord<Value>, error: unknown): void {
    record.data.abortController.abort();
    updateRecordToRejected(record, error);
  }

  async function processPendingRecord(
    abortController: AbortController,
    record: PendingRecord<Value>,
    ...params: Params
  ): Promise<void> {
    try {
      const valueOrPromise = load(params, abortController);
      const value = isPromiseLike(valueOrPromise) ? await valueOrPromise : valueOrPromise;

      if (abortController.signal.aborted || getRecord(...params) !== record) {
        debugLog("load-result-ignored", {
          aborted: abortController.signal.aborted,
          paramsCount: params.length,
        });
        return;
      }

      updateRecordToResolved(record, value);
      debugLog("load-resolved", { paramsCount: params.length });
      notifySubscribers(params, {
        status: STATUS_RESOLVED,
        value,
      });
    } catch (error) {
      if (abortController.signal.aborted || getRecord(...params) !== record) {
        debugLog("load-error-ignored", {
          aborted: abortController.signal.aborted,
          paramsCount: params.length,
        });
        return;
      }

      updateRecordToRejected(record, error);
      debugLog("load-rejected", { paramsCount: params.length });
      notifySubscribers(params, {
        error,
        status: STATUS_REJECTED,
      });
    }
  }

  function onExternalCacheEviction(key: string): void {
    const set = subscriberMap.get(key);

    if (!set) {
      debugLog("external-eviction-ignored");
      return;
    }

    debugLog("external-eviction", { subscriberCount: set.size });
    for (const callback of set) {
      callback({ status: STATUS_NOT_FOUND });
    }
  }

  const cacheApi: InternalCache<Params, Value> = {
    __getKey: getKey,
    __getOrCreateRecord: getOrCreateRecord,
    __notifySubscribers: notifySubscribers,
    __recordMap: recordMap,
    abort,
    cache,
    evict,
    evictAll,
    getStatus,
    getValue,
    getValueIfCached,
    prefetch,
    read,
    readAsync,
    subscribe,
  };

  return cacheApi;
}
