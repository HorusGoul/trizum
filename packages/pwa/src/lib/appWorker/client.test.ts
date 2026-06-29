import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Repo } from "@automerge/automerge-repo/slim";
import type { PartyBalanceHeadsResult } from "#src/lib/partyBalanceHeads.ts";
import type { Party } from "#src/models/party.ts";
import type { AppWorkerInitializeOptions } from "./proxy.ts";

type InitializeWorker = (options: AppWorkerInitializeOptions) => Promise<void>;
type RecalculateBalances = (partyId: Party["id"]) => Promise<PartyBalanceHeadsResult>;
type DispatchEvent = (event: Event) => boolean;

const recalculationResult: PartyBalanceHeadsResult = {
  balanceHeadsById: {},
};

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

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn<(message: string, properties?: Record<string, unknown>) => void>(),
  error: vi.fn<(message: string, properties?: Record<string, unknown>) => void>(),
  info: vi.fn<(message: string, properties?: Record<string, unknown>) => void>(),
  warning: vi.fn<(message: string, properties?: Record<string, unknown>) => void>(),
}));

vi.mock("#src/lib/log.ts", () => ({
  getLogger: () => loggerMock,
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
  let dispatchEvent: ReturnType<typeof vi.fn<DispatchEvent>>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dispatchEvent = vi.fn<DispatchEvent>(() => true);
    vi.stubGlobal("Worker", TestWorker);
    vi.stubGlobal("window", { dispatchEvent });
    proxyMock.injectAppWorker.mockClear();
    proxyMock.workerApis.length = 0;
    TestWorker.instances = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("restarts the worker and retries when a worker call fails", async () => {
    const firstApi = createWorkerApiMock({
      recalculateBalances: () => Promise.reject(new Error("worker failed")),
    });
    const secondApi = createWorkerApiMock();
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { appWorker, initializeAppWorker } = await import("./client.ts");

    await initializeAppWorker({
      repo,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: false,
    });

    await expect(appWorker.recalculateBalances(partyId)).resolves.toBe(recalculationResult);
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
    expect(loggerMock.debug).toHaveBeenCalledWith("App worker method call started", {
      methodName: "recalculateBalances",
      attempt: 1,
    });
    expect(loggerMock.warning).toHaveBeenCalledWith(
      "Restarting app worker after failed method call",
      expect.objectContaining({
        methodName: "recalculateBalances",
        attempt: 1,
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith("App worker method call succeeded after restart", {
      methodName: "recalculateBalances",
      attempt: 2,
    });
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  test("restarts the worker when initialization failed before a worker call", async () => {
    const firstApi = createWorkerApiMock({
      initialize: () => Promise.reject(new Error("worker init failed")),
    });
    const secondApi = createWorkerApiMock();
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { appWorker, initializeAppWorker } = await import("./client.ts");

    await expect(
      initializeAppWorker({
        repo,
        wssUrl: "wss://sync.example.test",
        isOfflineOnly: false,
      }),
    ).rejects.toThrow("worker init failed");

    await expect(appWorker.recalculateBalances(partyId)).resolves.toBe(recalculationResult);
    expect(firstApi.recalculateBalances).not.toHaveBeenCalled();
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
    expect(networkSubsystem.addNetworkAdapter).toHaveBeenCalledTimes(2);
    expect(networkSubsystem.removeNetworkAdapter).toHaveBeenCalledTimes(1);
  });

  test("requires a full app restart when a worker call fails after restart", async () => {
    const firstApi = createWorkerApiMock({
      recalculateBalances: () => Promise.reject(new Error("worker failed")),
    });
    const secondApi = createWorkerApiMock({
      recalculateBalances: () => Promise.reject(new Error("worker still failed")),
    });
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { APP_WORKER_FULL_RESTART_REQUIRED_EVENT, appWorker, initializeAppWorker } =
      await import("./client.ts");

    await initializeAppWorker({
      repo,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: false,
    });

    await expect(appWorker.recalculateBalances(partyId)).rejects.toThrow("worker still failed");

    expect(firstApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(partyId);
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
    expect(TestWorker.instances[1]?.terminate).toHaveBeenCalledOnce();
    expect(networkSubsystem.addNetworkAdapter).toHaveBeenCalledTimes(2);
    expect(networkSubsystem.removeNetworkAdapter).toHaveBeenCalledTimes(2);
    expect(loggerMock.error).toHaveBeenCalledWith(
      "App worker method call failed after restart",
      expect.objectContaining({
        methodName: "recalculateBalances",
        attempt: 2,
      }),
    );
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const [event] = dispatchEvent.mock.calls[0] ?? [];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event?.type).toBe(APP_WORKER_FULL_RESTART_REQUIRED_EVENT);
    expect((event as CustomEvent).detail).toEqual({
      methodName: "recalculateBalances",
    });

    await expect(appWorker.recalculateBalances(partyId)).rejects.toThrow("App restart required");

    expect(TestWorker.instances).toHaveLength(2);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });
});

function createWorkerApiMock({
  initialize = () => Promise.resolve(),
  recalculateBalances = () => Promise.resolve(recalculationResult),
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
