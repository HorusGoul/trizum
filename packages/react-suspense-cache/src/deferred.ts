import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import type { Deferred, StatusPending, StatusRejected, StatusResolved } from "./types.js";

export function createDeferred<Type>(debugLabel?: string): Deferred<Type> {
  let status: StatusPending | StatusRejected | StatusResolved = STATUS_PENDING;
  let rejectPromise: (error: unknown) => void = () => {};
  let resolvePromise: (value: Type | PromiseLike<Type>) => void = () => {};

  const promise = new Promise<Type>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  promise.catch(() => {
    // Prevent unhandled rejections for records that are read imperatively.
  });

  function assertPending() {
    if (status !== STATUS_PENDING) {
      throw new Error(`Deferred has already been ${status}`);
    }
  }

  return {
    debugLabel,
    promise,
    reject(error) {
      assertPending();
      status = STATUS_REJECTED;
      rejectPromise(error);
    },
    resolve(value) {
      assertPending();
      status = STATUS_RESOLVED;
      resolvePromise(value);
    },
    get status() {
      return status;
    },
  };
}
