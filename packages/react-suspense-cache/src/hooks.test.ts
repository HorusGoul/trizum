// @vitest-environment jsdom

import { act, createElement, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { STATUS_NOT_FOUND, STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createCache } from "./createCache.js";
import { useCacheStatus, useCacheValue, useImperativeCacheValue } from "./hooks.js";

describe("react cache hooks", () => {
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

  test("read suspends with React use and renders when the load resolves", async () => {
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

  test("useCacheStatus re-renders when subscribed cache status changes", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });
    const root = createTestRoot();
    const StatusReader = createStatusReader(cache);

    mountedRoots.push(root);

    await root.render(createElement(StatusReader, { id: "a" }));

    expect(root.container.textContent).toBe("not-found");

    await act(async () => {
      cache.cache("value:a", "a");
    });

    expect(root.container.textContent).toBe("resolved");
  });

  test("useCacheValue returns cached values", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });
    const root = createTestRoot();
    const ValueReader = createHookValueReader(cache);

    mountedRoots.push(root);
    cache.cache("value:a", "a");

    await root.render(createElement(ValueReader, { id: "a" }));

    expect(root.container.textContent).toBe("value:a");
  });

  test("useImperativeCacheValue keeps the previous value while a refresh is pending", async () => {
    const deferred = createTestDeferred<string>();
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: () => deferred.promise,
    });
    const root = createTestRoot();
    const ImperativeReader = createImperativeReader(cache);

    mountedRoots.push(root);
    cache.cache("old:a", "a");

    await root.render(createElement(ImperativeReader, { id: "a" }));

    expect(root.container.textContent).toBe("resolved:old:a");

    await act(async () => {
      cache.evict("a");
      cache.readAsync("a");
    });

    expect(root.container.textContent).toBe("pending:old:a");
  });

  test("useImperativeCacheValue reports rejected values", async () => {
    const error = new Error("load failed");
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async () => {
        throw error;
      },
    });
    const root = createTestRoot();
    const ImperativeReader = createImperativeReader(cache);

    mountedRoots.push(root);

    await expect(cache.readAsync("a")).rejects.toBe(error);
    await root.render(createElement(ImperativeReader, { id: "a" }));

    expect(root.container.textContent).toBe(`${STATUS_REJECTED}:load failed`);
  });

  test("useImperativeCacheValue reports missing values", async () => {
    const cache = createCache<[string], string>({
      getKey: ([id]) => id,
      load: async ([id]) => `value:${id}`,
    });
    const root = createTestRoot();
    const ImperativeReader = createImperativeReader(cache);

    mountedRoots.push(root);

    await root.render(createElement(ImperativeReader, { id: "a" }));

    expect(root.container.textContent).toBe(`${STATUS_NOT_FOUND}:`);
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
    return createElement("span", null, cache.read(id));
  }

  return CacheReader;
}

function createHookValueReader(cache: ReturnType<typeof createCache<[string], string>>) {
  function HookValueReader({ id }: { id: string }) {
    return createElement("span", null, useCacheValue(cache, id));
  }

  return HookValueReader;
}

function createStatusReader(cache: ReturnType<typeof createCache<[string], string>>) {
  function StatusReader({ id }: { id: string }) {
    return createElement("span", null, useCacheStatus(cache, id));
  }

  return StatusReader;
}

function createImperativeReader(cache: ReturnType<typeof createCache<[string], string>>) {
  function ImperativeReader({ id }: { id: string }) {
    const result = useImperativeCacheValue(cache, id);
    const label =
      result.status === STATUS_REJECTED
        ? result.error instanceof Error
          ? result.error.message
          : String(result.error)
        : (result.value ?? "");

    return createElement("span", null, `${result.status}:${label}`);
  }

  return ImperativeReader;
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
