// @vitest-environment node

import { afterEach, expect, it, vi } from "vite-plus/test";
import { cancelIdleCallback, requestIdleCallback } from "@trizum/ui/requestIdleCallback";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("returns numeric fallback handles that cancel the intended callback", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", undefined);
  const cancelled = vi.fn<Parameters<typeof requestIdleCallback>[0]>();
  const pending = vi.fn<Parameters<typeof requestIdleCallback>[0]>();
  const cancelledHandle = requestIdleCallback(cancelled);
  const pendingHandle = requestIdleCallback(pending);

  expect(cancelledHandle).toEqual(expect.any(Number));
  expect(pendingHandle).toEqual(expect.any(Number));
  cancelIdleCallback(cancelledHandle);
  vi.runAllTimers();

  expect(cancelled).not.toHaveBeenCalled();
  expect(pending).toHaveBeenCalledExactlyOnceWith({
    didTimeout: true,
    timeRemaining: expect.any(Function),
  });
});
