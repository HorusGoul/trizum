/** Link read lifetimes using the browser APIs supported by the PWA's Safari target. */
export function createReadScope(parents: readonly (AbortSignal | undefined)[], timeout?: number) {
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];

  for (const parent of parents) {
    if (!parent) continue;

    const abort = () => controller.abort(parent.reason);
    parent.addEventListener("abort", abort, { once: true });
    cleanups.push(() => parent.removeEventListener("abort", abort));

    if (parent.aborted) abort();
  }

  const timer =
    timeout === undefined
      ? undefined
      : setTimeout(() => {
          controller.abort(new DOMException("Document read timed out", "TimeoutError"));
        }, timeout);

  return {
    signal: controller.signal,
    dispose() {
      if (timer !== undefined) clearTimeout(timer);

      for (const cleanup of cleanups) cleanup();
    },
  };
}
