/**
 * Retry utilities with exponential backoff.
 *
 * These utilities are used internally by the SDK to handle transient failures
 * when loading documents from the document repository.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 10 */
  maxAttempts?: number;
  /** Base delay in milliseconds. Default: 100 */
  baseDelay?: number;
  /** Maximum delay in milliseconds. Default: 10000 */
  maxDelay?: number;
  /** Jitter factor (0-1) to randomize delays. Default: 0.1 */
  jitter?: number;
  /** Timeout per attempt in milliseconds. Default: 3000 */
  timeout?: number;
}

/**
 * Error thrown when a retry operation is aborted via AbortSignal.
 */
export class RetryAbortedError extends Error {
  constructor() {
    super("Retry aborted");
    this.name = "RetryAbortedError";
  }
}

/**
 * Error thrown when all retry attempts have been exhausted.
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`Max retries exceeded after ${attempts} attempts`);
    this.name = "MaxRetriesExceededError";
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryAbortedError());
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new RetryAbortedError());
      },
      { once: true },
    );
  });
}

function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: number,
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter to prevent thundering herd
  const jitterAmount = clampedDelay * jitter * Math.random();
  return clampedDelay + jitterAmount;
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @param fn - The async function to retry. Receives an options object with an abort signal.
 * @param options - Retry configuration options.
 * @returns The result of the function if successful.
 * @throws {RetryAbortedError} If the operation is aborted via the abort signal.
 * @throws {MaxRetriesExceededError} If all retry attempts are exhausted.
 *
 * @example
 * ```ts
 * const result = await retryWithExponentialBackoff(
 *   async ({ signal }) => {
 *     return await fetchData({ signal });
 *   },
 *   { maxAttempts: 5, timeout: 5000 }
 * );
 * ```
 */
export async function retryWithExponentialBackoff<T>(
  fn: (options: { signal: AbortSignal }) => Promise<T>,
  options: RetryOptions & { signal?: AbortSignal } = {},
): Promise<T> {
  const {
    maxAttempts = 10,
    baseDelay = 100,
    maxDelay = 10_000,
    jitter = 0.1,
    timeout = 3_000,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new RetryAbortedError();
    }

    try {
      // Create a child AbortController that aborts when:
      // 1. The parent signal aborts
      // 2. The timeout is reached
      const attemptController = new AbortController();
      const timeoutId = setTimeout(() => attemptController.abort(), timeout);
      const abortHandler = () => attemptController.abort();
      signal?.addEventListener("abort", abortHandler, { once: true });

      try {
        return await fn({ signal: attemptController.signal });
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abortHandler);
      }
    } catch (error) {
      lastError = error;

      // Don't retry if parent signal was aborted
      if (signal?.aborted) {
        throw new RetryAbortedError();
      }

      // If this was the last attempt, break
      if (attempt === maxAttempts - 1) {
        break;
      }

      // Wait before retrying
      const backoffDelay = calculateBackoffDelay(
        attempt,
        baseDelay,
        maxDelay,
        jitter,
      );
      await delay(backoffDelay, signal);
    }
  }

  throw new MaxRetriesExceededError(maxAttempts, lastError);
}
