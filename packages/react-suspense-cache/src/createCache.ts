import { use } from "react";
import {
  STATUS_ABORTED,
  STATUS_NOT_FOUND,
  STATUS_PENDING,
  STATUS_REJECTED,
  STATUS_RESOLVED,
} from "./constants.js";
import { createDeferred } from "./deferred.js";
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
  CacheMap,
  CreateCacheOptions,
  InternalCache,
  PendingRecord,
  Record,
  Status,
  SubscriptionCallback,
  SubscriptionData,
  UnsubscribeCallback,
} from "./types.js";

function isPromiseLike<Type>(value: PromiseLike<Type> | Type): value is PromiseLike<Type> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function defaultGetKey(params: Array<any>): string {
  return params.map((param) => String(param)).join(",");
}

function defaultGetCache<Value>(): CacheMap<string, Record<Value>> {
  return new Map<string, Record<Value>>();
}

export function createCache<Params extends Array<any>, Value>(
  options: CreateCacheOptions<Params, Value>,
): Cache<Params, Value> {
  let { config = {}, debugLogging = false, debugLabel, getKey = defaultGetKey, load } = options;
  const { getCache = defaultGetCache } = config;
  const recordMap = getCache(onExternalCacheEviction);
  const subscriberMap = new Map<string, Set<SubscriptionCallback<Value>>>();

  function debugLog(_message: string, _params?: Params, ..._args: unknown[]) {
    if (!debugLogging) {
      return;
    }
  }

  function abort(...params: Params): boolean {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    if (!record || !isPendingRecord(record)) {
      return false;
    }

    debugLog("abort()", params);
    record.data.abortController.abort();
    recordMap.delete(cacheKey);
    notifySubscribers(params, { status: STATUS_ABORTED });

    return true;
  }

  function cache(value: Value, ...params: Params): void {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    debugLog("cache()", params);

    if (record && isPendingRecord(record)) {
      const { abortController, deferred } = record.data;

      abortController.abort();
      updateRecordToResolved(record, value);
      deferred.resolve(value);
      recordMap.set(cacheKey, record);
    } else {
      recordMap.set(cacheKey, createResolvedRecord(value));
    }

    notifySubscribers(params, {
      status: STATUS_RESOLVED,
      value,
    });
  }

  function disableDebugLogging(): void {
    debugLogging = false;
  }

  function enableDebugLogging(): void {
    debugLogging = true;
  }

  function evict(...params: Params): boolean {
    const cacheKey = getKey(params);
    const record = recordMap.get(cacheKey);

    debugLog("evict()", params);

    if (record && isPendingRecord(record)) {
      record.data.abortController.abort();
    }

    const didDelete = recordMap.delete(cacheKey);
    notifySubscribers(params, { status: STATUS_NOT_FOUND });

    return didDelete;
  }

  function evictAll(): void {
    debugLog("evictAll()");

    for (const record of recordMapValues()) {
      if (isPendingRecord(record)) {
        record.data.abortController.abort();
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

  function getRecord(...params: Params): Record<Value> | undefined {
    return recordMap.get(getKey(params));
  }

  function getOrCreateRecord(...params: Params): Record<Value> {
    const cacheKey = getKey(params);
    let record = recordMap.get(cacheKey);

    if (record) {
      debugLog("read() cache hit", params);
      return record;
    }

    debugLog("read() cache miss", params);

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
    try {
      const promiseOrValue = readAsync(...params);

      if (isPromiseLike(promiseOrValue)) {
        promiseOrValue.then(
          () => {},
          () => {},
        );
      }
    } catch {
      // Already-cached errors are surfaced by read/getValue.
    }
  }

  const read: Cache<Params, Value>["read"] = function useCacheRead(...params: Params): Value {
    const record = getOrCreateRecord(...params);

    if (isPendingRecord(record)) {
      return use(record.data.deferred.promise);
    }

    if (isResolvedRecord(record)) {
      return record.data.value;
    }

    throw record.data.error;
  };

  function readAsync(...params: Params): PromiseLike<Value> | Value {
    const record = getOrCreateRecord(...params);

    if (isPendingRecord(record)) {
      return record.data.deferred.promise;
    }

    if (isResolvedRecord(record)) {
      return record.data.value;
    }

    throw record.data.error;
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

  async function processPendingRecord(
    abortController: AbortController,
    record: PendingRecord<Value>,
    ...params: Params
  ): Promise<void> {
    const { deferred } = record.data;

    try {
      const valueOrPromise = load(params, abortController);
      const value = isPromiseLike(valueOrPromise) ? await valueOrPromise : valueOrPromise;

      if (abortController.signal.aborted || getRecord(...params) !== record) {
        return;
      }

      updateRecordToResolved(record, value);
      deferred.resolve(value);
      notifySubscribers(params, {
        status: STATUS_RESOLVED,
        value,
      });
    } catch (error) {
      if (abortController.signal.aborted || getRecord(...params) !== record) {
        return;
      }

      updateRecordToRejected(record, error);
      deferred.reject(error);
      notifySubscribers(params, {
        error,
        status: STATUS_REJECTED,
      });
    }
  }

  function onExternalCacheEviction(key: string): void {
    const set = subscriberMap.get(key);

    if (!set) {
      return;
    }

    for (const callback of set) {
      callback({ status: STATUS_NOT_FOUND });
    }
  }

  function recordMapValues(): Record<Value>[] {
    if (recordMap instanceof Map) {
      return Array.from(recordMap.values());
    }

    return [];
  }

  const cacheApi: InternalCache<Params, Value> = {
    __getKey: getKey,
    __getOrCreateRecord: getOrCreateRecord,
    __notifySubscribers: notifySubscribers,
    __recordMap: recordMap,
    abort,
    cache,
    disableDebugLogging,
    enableDebugLogging,
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
