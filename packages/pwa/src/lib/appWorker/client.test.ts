import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Repo } from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.ts";
import type { AppWorkerInitializeOptions } from "./proxy.ts";

type InitializeWorker = (options: AppWorkerInitializeOptions) => Promise<void>;
type RecalculateBalances = (partyId: Party["id"]) => Promise<boolean>;

const proxyMock = vi.hoisted(() => {
  const workerApis: unknown[] = [];
  const injectAppWorker = vi.fn<(adapter: unknown) => unknown>(() => {
    const api = workerApis.shift();

    if (!api) {
      throw new Error("No app worker API mock queued");
    }

    return api;
  });

  return {
    injectAppWorker,
    workerApis,
  };
});

vi.mock("#src/lib/log.ts", () => ({
  getLogger: () => ({
    warning() {},
  }),
}));

vi.mock("./proxy.ts", () => ({
  injectAppWorker: proxyMock.injectAppWorker,
}));

class TestWorker {
  static instances: TestWorker[] = [];

  addEventListener = vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>();
  postMessage = vi.fn<(message: unknown, transfer?: Transferable[]) => void>();
  removeEventListener =
    vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>();
  terminate = vi.fn<() => void>();

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    TestWorker.instances.push(this);
  }
}

describe("app worker client", () => {
  const partyId = "party-id" as Party["id"];

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("Worker", TestWorker);
    proxyMock.injectAppWorker.mockClear();
    proxyMock.workerApis.length = 0;
    TestWorker.instances = [];
  });

  test("restarts the worker and retries when a worker call fails", async () => {
    const firstApi = createWorkerApiMock({
      recalculateBalances: () => Promise.reject(new Error("worker failed")),
    });
    const secondApi = createWorkerApiMock();
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { initializeAppWorker, recalculatePartyBalancesInWorker } = await import("./client.ts");

    await initializeAppWorker({
      repo,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: false,
    });

    await expect(recalculatePartyBalancesInWorker(partyId)).resolves.toBe(true);
    expect(firstApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(secondApi.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        wssUrl: "wss://sync.example.test",
        isOfflineOnly: false,
      }),
    );
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
    expect(networkSubsystem.addNetworkAdapter).toHaveBeenCalledTimes(2);
    expect(networkSubsystem.removeNetworkAdapter).toHaveBeenCalledTimes(1);
    expect(networkSubsystem.removeNetworkAdapter).toHaveBeenCalledWith(
      networkSubsystem.addNetworkAdapter.mock.calls[0]?.[0],
    );
  });

  test("restarts the worker when initialization failed before a worker call", async () => {
    const firstApi = createWorkerApiMock({
      initialize: () => Promise.reject(new Error("worker init failed")),
    });
    const secondApi = createWorkerApiMock();
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { initializeAppWorker, recalculatePartyBalancesInWorker } = await import("./client.ts");

    await expect(
      initializeAppWorker({
        repo,
        wssUrl: "wss://sync.example.test",
        isOfflineOnly: false,
      }),
    ).rejects.toThrow("worker init failed");

    await expect(recalculatePartyBalancesInWorker(partyId)).resolves.toBe(true);
    expect(firstApi.recalculateBalances).not.toHaveBeenCalled();
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
    expect(networkSubsystem.addNetworkAdapter).toHaveBeenCalledTimes(2);
    expect(networkSubsystem.removeNetworkAdapter).toHaveBeenCalledTimes(1);
  });
});

function createWorkerApiMock({
  initialize = () => Promise.resolve(),
  recalculateBalances = () => Promise.resolve(true),
}: {
  initialize?: InitializeWorker;
  recalculateBalances?: RecalculateBalances;
} = {}) {
  return {
    initialize: vi.fn<InitializeWorker>(initialize),
    recalculateBalances: vi.fn<RecalculateBalances>(recalculateBalances),
  };
}

function createRepoMock() {
  const networkSubsystem = {
    addNetworkAdapter: vi.fn<(adapter: unknown) => void>(),
    removeNetworkAdapter: vi.fn<(adapter: unknown) => void>(),
  };

  return {
    networkSubsystem,
    repo: {
      networkSubsystem,
    } as unknown as Repo,
  };
}
