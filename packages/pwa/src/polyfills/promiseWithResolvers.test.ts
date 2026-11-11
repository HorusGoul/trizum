import { execFileSync } from "node:child_process";
import { expect, test } from "vite-plus/test";

test("initializes the real worker proxy without native Promise.withResolvers", () => {
  // A separate realm prevents changing Promise for concurrently running tests.
  const proxyUrl = new URL("../lib/appWorker/proxy.ts", import.meta.url).href;

  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    Promise.withResolvers = undefined;
    const { defineAppWorkerProvider, injectAppWorker } = await import(${JSON.stringify(proxyUrl)});
    const listeners = [new Set(), new Set()];
    const adapter = (index) => ({
      sendMessage(message) {
        queueMicrotask(() => {
          for (const callback of listeners[1 - index]) callback(message);
        });
      },
      onMessage(callback) {
        listeners[index].add(callback);
        return () => listeners[index].delete(callback);
      },
    });
    let initialized = false;
    defineAppWorkerProvider(() => ({
      async initialize() { initialized = true; },
      async recalculateBalances() { return []; },
    }))(adapter(0));
    await injectAppWorker(adapter(1)).initialize({ isOfflineOnly: true });
    assert.equal(initialized, true);
    const { promise, reject } = Promise.withResolvers();
    reject(new Error("expected rejection"));
    await assert.rejects(promise, /expected rejection/);
    console.log("worker initialized");
  `,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );

  expect(output.trim()).toBe("worker initialized");
});

test("preserves native Promise.withResolvers", () => {
  const compatibilityUrl = new URL("./promiseWithResolvers.ts", import.meta.url).href;

  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    const native = Promise.withResolvers;
    await import(${JSON.stringify(compatibilityUrl)});
    assert.equal(Promise.withResolvers, native);
  `,
    ],
    { timeout: 15_000 },
  );

  expect(output.length).toBe(0);
});
