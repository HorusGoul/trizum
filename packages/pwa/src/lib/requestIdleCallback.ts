/**
 * Polyfill for requestIdleCallback that works in Safari and other browsers
 * that don't support the native API.
 *
 * Falls back to setTimeout with a 1ms delay when the native API is unavailable.
 */

interface IdleCallbackOptions {
  timeout?: number;
}

/**
 * Schedules a callback to run during the browser's idle periods.
 * Falls back to setTimeout in browsers that don't support requestIdleCallback.
 *
 * @param callback - Function to call during idle time
 * @param options - Optional configuration with timeout
 * @returns Handle ID that can be used to cancel the callback
 */
export function requestIdleCallback(
  callback: (deadline: {
    didTimeout: boolean;
    timeRemaining: () => number;
  }) => void,
  options?: IdleCallbackOptions,
): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return window.requestIdleCallback(callback, options);
  }

  // Polyfill using setTimeout
  const start = Date.now();
  const timeout = options?.timeout ?? 0;

  const handle = setTimeout(
    () => {
      callback({
        didTimeout: true,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    },
    Math.max(1, timeout),
  );

  // Return the timeout ID as a number (compatible with native API)
  return handle as unknown as number;
}

/**
 * Cancels a previously scheduled idle callback.
 *
 * @param handleId - Handle ID returned from requestIdleCallback
 */
export function cancelIdleCallback(handleId: number): void {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(handleId);
  } else {
    // Polyfill: clearTimeout for the setTimeout fallback
    clearTimeout(handleId as unknown as ReturnType<typeof setTimeout>);
  }
}
