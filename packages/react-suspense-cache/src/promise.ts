import { z } from "zod";
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
  return thenableSchema.safeParse(value).success;
}

export function markReactPromisePending<Type>(
  promise: Promise<Type>,
): asserts promise is PendingReactUsePromise<Type> {
  const reactPromise: MutableReactUsePromise<Type> = promise;

  reactPromise.status = STATUS_PENDING;
  delete reactPromise.value;
  delete reactPromise.reason;
}

export function markReactPromiseFulfilled<Type>(
  promise: Promise<Type>,
  value: Type,
): asserts promise is FulfilledReactUsePromise<Type> {
  const reactPromise: MutableReactUsePromise<Type> = promise;

  reactPromise.status = STATUS_FULFILLED;
  reactPromise.value = value;
  delete reactPromise.reason;
}

export function markReactPromiseRejected<Type>(
  promise: Promise<Type>,
  cause: unknown,
): asserts promise is RejectedReactUsePromise<Type> {
  const reactPromise: MutableReactUsePromise<Type> = promise;

  reactPromise.status = STATUS_REJECTED;
  reactPromise.reason = cause;
  delete reactPromise.value;
}

export function createFulfilledReactPromise<Type>(value: Type): ReactUsePromise<Type> {
  const promise = Promise.resolve(value);

  markReactPromiseFulfilled(promise, value);

  return promise;
}

export function createRejectedReactPromise<Type = never>(cause: unknown): ReactUsePromise<Type> {
  const promise = Promise.reject<Type>(cause);

  markReactPromiseRejected(promise, cause);
  void promise.catch(() => {
    // Prevent unhandled rejections for records that are read imperatively.
  });

  return promise;
}

const callableSchema = z.function();

const thenableSchema = z
  .custom<object>(
    (value) =>
      value !== null && Object(value) === value && !callableSchema.safeParse(value).success,
  )
  .refine((value) => "then" in value && callableSchema.safeParse(value.then).success);
