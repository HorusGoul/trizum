import { describe, expect, test, vi } from "vite-plus/test";
import { createKeyedCoalescedQueue } from "./coalescedQueue.ts";

describe("createKeyedCoalescedQueue", () => {
  test("coalesces same-key requests into one follow-up run", async () => {
    const firstRun = createDeferred<string>();
    const run = vi
      .fn<(key: string) => Promise<string>>()
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValueOnce("second");
    const enqueue = createKeyedCoalescedQueue({ run });

    const firstRequest = enqueue("party");
    const secondRequest = enqueue("party");
    const thirdRequest = enqueue("party");

    expect(secondRequest).toBe(firstRequest);
    expect(thirdRequest).toBe(firstRequest);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("party");

    firstRun.resolve("first");

    await expect(firstRequest).resolves.toBe("second");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith("party");
  });

  test("runs different keys independently", async () => {
    const firstRun = createDeferred<string>();
    const secondRun = createDeferred<string>();
    const run = vi.fn<(key: string) => Promise<string>>((key) => {
      if (key === "first") {
        return firstRun.promise;
      }

      return secondRun.promise;
    });
    const enqueue = createKeyedCoalescedQueue({ run });

    const firstRequest = enqueue("first");
    const secondRequest = enqueue("second");

    expect(firstRequest).not.toBe(secondRequest);
    expect(run).toHaveBeenCalledTimes(2);

    secondRun.resolve("second result");
    await expect(secondRequest).resolves.toBe("second result");

    firstRun.resolve("first result");
    await expect(firstRequest).resolves.toBe("first result");
  });

  test("starts a new run after the previous queue settles", async () => {
    const run = vi
      .fn<(key: string) => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const enqueue = createKeyedCoalescedQueue({ run });

    await expect(enqueue("party")).resolves.toBe("first");
    await expect(enqueue("party")).resolves.toBe("second");

    expect(run).toHaveBeenCalledTimes(2);
  });

  test("recovers from errors and clears the queued state", async () => {
    const error = new Error("failed");
    const recover = vi.fn<(error: unknown, key: string) => string>(() => "fallback");
    const run = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("next");
    const enqueue = createKeyedCoalescedQueue({ run, recover });

    await expect(enqueue("party")).resolves.toBe("fallback");
    expect(recover).toHaveBeenCalledWith(error, "party");

    await expect(enqueue("party")).resolves.toBe("next");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

function createDeferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve: resolve!,
  };
}
