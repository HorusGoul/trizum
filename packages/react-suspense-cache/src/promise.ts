import { STATUS_PENDING, STATUS_REJECTED } from "./constants.js";
import type {
  FulfilledReactUsePromise,
  PendingReactUsePromise,
  ReactPromiseStatus,
  ReactUsePromise,
  RejectedReactUsePromise,
} from "./types.js";

const STATUS_FULFILLED = "fulfilled";

type MutableReactUsePromise<Type> = Promise<Type> & {
  reason?: unknown;
  status?: ReactPromiseStatus;
  value?: Type;
};

export function isPromiseLike<Type>(value: PromiseLike<Type> | Type): value is PromiseLike<Type> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

export function markReactPromisePending<Type>(
  promise: Promise<Type>,
): asserts promise is PendingReactUsePromise<Type> {
  const reactPromise = promise as MutableReactUsePromise<Type>;

  reactPromise.status = STATUS_PENDING;
  delete reactPromise.value;
  delete reactPromise.reason;
}

export function markReactPromiseFulfilled<Type>(
  promise: Promise<Type>,
  value: Type,
): asserts promise is FulfilledReactUsePromise<Type> {
  const reactPromise = promise as MutableReactUsePromise<Type>;

  reactPromise.status = STATUS_FULFILLED;
  reactPromise.value = value;
  delete reactPromise.reason;
}

export function markReactPromiseRejected<Type>(
  promise: Promise<Type>,
  reason: unknown,
): asserts promise is RejectedReactUsePromise<Type> {
  const reactPromise = promise as MutableReactUsePromise<Type>;

  reactPromise.status = STATUS_REJECTED;
  reactPromise.reason = reason;
  delete reactPromise.value;
}

export function createFulfilledReactPromise<Type>(value: Type): ReactUsePromise<Type> {
  const promise = Promise.resolve(value);

  markReactPromiseFulfilled(promise, value);

  return promise;
}

export function createRejectedReactPromise<Type = never>(reason: unknown): ReactUsePromise<Type> {
  const promise = Promise.reject(reason) as Promise<Type>;

  markReactPromiseRejected(promise, reason);
  void promise.catch(() => {
    // Prevent unhandled rejections for records that are read imperatively.
  });

  return promise;
}
