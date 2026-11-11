// comctx's heartbeat uses this API in both the window and worker realms.
// Older supported WebViews can run our bundle but do not provide it.
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Runtime feature detection is required for older WebViews.
if (!("withResolvers" in Promise) || typeof Promise.withResolvers !== "function") {
  Object.defineProperty(Promise, "withResolvers", {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(this: PromiseConstructor) {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: Parameters<ConstructorParameters<PromiseConstructor>[0]>[1];

      const promise = new this<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });

      return { promise, resolve, reject };
    },
  });
}
