import { useDeferredValue, useRef, useSyncExternalStore } from "react";
import { STATUS_NOT_FOUND, STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import type { Cache, ImperativeCacheValue, Status } from "./types.js";

function areParamsEqual<Params extends Array<any>>(left: Params, right: Params): boolean {
  return (
    left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
  );
}

export function useCacheStatus<Params extends Array<any>>(
  cache: Cache<Params, any>,
  ...params: Params
): Status {
  return useSyncExternalStore<Status>(
    (callback) => cache.subscribe(() => callback(), ...params),
    () => cache.getStatus(...params),
    () => cache.getStatus(...params),
  );
}

export function useCacheValue<Params extends Array<any>, Value>(
  cache: Cache<Params, Value>,
  ...params: Params
): Value {
  return cache.read(...params);
}

export function useImperativeCacheValue<Params extends Array<any>, Value>(
  cache: Cache<Params, Value>,
  ...params: Params
): ImperativeCacheValue<Value> {
  const status = useCacheStatus(cache, ...params);
  const previousResolvedRef = useRef<{ params: Params; value: Value } | undefined>(undefined);

  let error: unknown;
  let value: Value | undefined;

  if (status === STATUS_RESOLVED) {
    value = cache.getValue(...params);
    previousResolvedRef.current = { params, value };
  } else if (
    status === STATUS_PENDING &&
    previousResolvedRef.current &&
    areParamsEqual(previousResolvedRef.current.params, params)
  ) {
    value = previousResolvedRef.current.value;
  } else if (status === STATUS_REJECTED) {
    try {
      cache.getValue(...params);
    } catch (caught) {
      error = caught;
    }
  }

  const deferredValue = useDeferredValue(value);

  if (status === STATUS_RESOLVED) {
    return {
      error: undefined,
      status,
      value: deferredValue as Value,
    };
  }

  if (status === STATUS_PENDING) {
    return {
      error: undefined,
      status,
      value: deferredValue,
    };
  }

  if (status === STATUS_REJECTED) {
    return {
      error,
      status,
      value: undefined,
    };
  }

  return {
    error: undefined,
    status: STATUS_NOT_FOUND,
    value: undefined,
  };
}
