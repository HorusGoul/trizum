// @vitest-environment jsdom

import { act, createElement, Suspense, use, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { STATUS_PENDING, STATUS_RESOLVED } from "./constants.js";
import { createCache } from "./createCache.js";

describe("React use integration", () => {
  const mountedRoots: TestRoot[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      await mountedRoots.pop()?.unmount();
    }
  });

  test("readAsync suspends with React use and renders when the load resolves", async () => {
    const deferred = createTestDeferred<string>();
    const load = vi.fn<(params: [string]) => Promise<string>>(() => deferred.promise);
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load,
    });
    const root = createTestRoot();
    const Reader = createCacheReader(cache);

    mountedRoots.push(root);

    await root.render(
      createElement(
        Suspense,
        { fallback: createElement("span", null, "loading") },
        createElement(Reader, { id: "a" }),
      ),
    );

    expect(root.container.textContent).toBe("loading");
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.getStatus("a")).toBe(STATUS_PENDING);

    await act(async () => {
      deferred.resolve("value:a");
      await deferred.promise;
    });

    expect(root.container.textContent).toBe("value:a");
    expect(cache.getStatus("a")).toBe(STATUS_RESOLVED);
  });
});

interface TestRoot {
  container: HTMLDivElement;
  render(element: ReactNode): Promise<void>;
  unmount(): Promise<void>;
}

function createTestRoot(): TestRoot {
  const container = document.createElement("div");
  const root: Root = createRoot(container);

  document.body.append(container);

  return {
    container,
    async render(element) {
      await act(async () => {
        root.render(element);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createCacheReader(cache: ReturnType<typeof createCache<[string], string>>) {
  function CacheReader({ id }: { id: string }) {
    return createElement("span", null, use(cache.readAsync(id)));
  }

  return CacheReader;
}

function createTestDeferred<Value>() {
  let rejectPromise: (error: unknown) => void = () => {};
  let resolvePromise: (value: Value) => void = () => {};
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}
