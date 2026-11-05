import { afterEach, expect, test, vi } from "vite-plus/test";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { WorkerAdapter, type WorkerEndpoint } from "./WorkerAdapter.ts";
import { defineAppWorkerProvider, injectAppWorker } from "./proxy.ts";
import type { AppWorkerApi } from "./proxy.ts";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("initializes a healthy worker that takes longer than one second to respond", async () => {
  vi.useFakeTimers();
  const { client, provider } = createWorkerEndpoints(1500);
  const initialize = vi.fn<AppWorkerApi["initialize"]>(async () => {});
  defineAppWorkerProvider(() => ({
    initialize,
    recalculateBalances: async () => [],
  }))(new WorkerAdapter(provider));
  const api = injectAppWorker(new WorkerAdapter(client));
  const channel = new MessageChannel();

  try {
    const options = {
      repoPort: channel.port2,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: true,
    };

    await Promise.all([
      expect(api.initialize(options)).resolves.toBeUndefined(),
      vi.advanceTimersByTimeAsync(4000),
    ]);
    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledWith(options);
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
});

test("calls a busy worker after initialization without rejecting its heartbeat", async () => {
  vi.useFakeTimers();
  const endpoints = createWorkerEndpoints(0);
  const recalculateBalances = vi.fn<AppWorkerApi["recalculateBalances"]>(async () => []);
  defineAppWorkerProvider(() => ({
    initialize: async () => {},
    recalculateBalances,
  }))(new WorkerAdapter(endpoints.provider));
  const api = injectAppWorker(new WorkerAdapter(endpoints.client));
  const channel = new MessageChannel();

  try {
    await Promise.all([
      api.initialize({
        repoPort: channel.port2,
        wssUrl: "wss://sync.example.test",
        isOfflineOnly: true,
      }),
      vi.advanceTimersByTimeAsync(100),
    ]);
    endpoints.setWorkerDelay(1500);

    const request = {
      partyId: parseAutomergeUrl(generateAutomergeUrl()).documentId,
      documents: [],
    };

    await Promise.all([
      expect(api.recalculateBalances(request)).resolves.toEqual([]),
      vi.advanceTimersByTimeAsync(4000),
    ]);
    expect(recalculateBalances).toHaveBeenCalledOnce();
    expect(recalculateBalances).toHaveBeenCalledWith(request);
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
});

test("still rejects when the worker provider never responds", async () => {
  vi.useFakeTimers();
  const { client } = createWorkerEndpoints(0);
  const api = injectAppWorker(new WorkerAdapter(client));

  const request = {
    partyId: parseAutomergeUrl(generateAutomergeUrl()).documentId,
    documents: [],
  };

  await Promise.all([
    expect(api.recalculateBalances(request)).rejects.toThrow(
      /Provider unavailable: heartbeat check timeout \d+ms\./,
    ),
    vi.advanceTimersByTimeAsync(10_000),
  ]);
});

function createWorkerEndpoints(workerDelay: number) {
  const clientListeners = new Set<(event: MessageEvent) => void>();
  const providerListeners = new Set<(event: MessageEvent) => void>();

  function endpoint(
    incoming: Set<(event: MessageEvent) => void>,
    outgoing: Set<(event: MessageEvent) => void>,
    delay: () => number,
  ): WorkerEndpoint {
    return {
      postMessage(message) {
        setTimeout(() => {
          for (const listener of outgoing) {
            listener(new MessageEvent("message", { data: message }));
          }
        }, delay());
      },
      addEventListener(_type, listener) {
        incoming.add(listener);
      },
      removeEventListener(_type, listener) {
        incoming.delete(listener);
      },
    };
  }

  return {
    client: endpoint(clientListeners, providerListeners, () => workerDelay),
    provider: endpoint(providerListeners, clientListeners, () => 0),
    setWorkerDelay(delay: number) {
      workerDelay = delay;
    },
  };
}
