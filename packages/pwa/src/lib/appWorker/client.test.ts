import type { LogRecord } from "@trizum/logging";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { Repo } from "@automerge/automerge-repo";
import type { Party } from "#src/models/party.ts";
import type { DocumentHeads, RecalculateBalancesRequest } from "./balanceSync.ts";
import type { AppWorkerApi, AppWorkerInitializeOptions } from "./proxy.ts";
import type { WorkerAdapter, WorkerEndpoint } from "./WorkerAdapter.ts";

type InitializeWorker = (options: AppWorkerInitializeOptions) => Promise<void>;

type RecalculateBalances = (request: RecalculateBalancesRequest) => Promise<DocumentHeads[]>;

type DispatchEvent = (event: Event) => boolean;

const proxyMock = vi.hoisted(() => {
  const workerApis: AppWorkerApi[] = [];

  const injectAppWorker = vi.fn<(adapter: WorkerAdapter) => AppWorkerApi>(() => {
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
  debug: vi.fn<(message: string, properties?: LogRecord["properties"]) => void>(),
  error: vi.fn<(message: string, properties?: LogRecord["properties"]) => void>(),
  info: vi.fn<(message: string, properties?: LogRecord["properties"]) => void>(),
  warning: vi.fn<(message: string, properties?: LogRecord["properties"]) => void>(),
}));

class TestWorker {
  static instances: TestWorker[] = [];

  addEventListener = vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>();
  postMessage = vi.fn<WorkerEndpoint["postMessage"]>();
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

import { createAppWorkerClient, APP_WORKER_FULL_RESTART_REQUIRED_EVENT } from "./client.ts";
import { capturePwaLogs } from "../testing/captureLogs.ts";

let stopLogging: () => void;

function createClient() {
  return createAppWorkerClient({ connect: proxyMock.injectAppWorker });
}

describe("app worker client", () => {
  // SAFETY: Synthetic document IDs only key the in-memory fixture; this test never decodes them or opens a network document.

  let dispatchEvent: ReturnType<typeof vi.fn<DispatchEvent>>;

  beforeEach(() => {
    stopLogging = capturePwaLogs((record) => {
      if (
        record.level === "debug" ||
        record.level === "info" ||
        record.level === "warning" ||
        record.level === "error"
      ) {
        loggerMock[record.level](String(record.rawMessage), record.properties);
      }
    });
    vi.clearAllMocks();
    dispatchEvent = vi.fn<DispatchEvent>(() => true);
    vi.stubGlobal("Worker", TestWorker);
    vi.stubGlobal("window", { dispatchEvent });
    proxyMock.injectAppWorker.mockClear();
    proxyMock.workerApis.length = 0;
    TestWorker.instances = [];
  });

  afterEach(async () => {
    await Promise.all(testRepos.splice(0).map((repo) => repo.shutdown()));
    stopLogging();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("restarts the worker and retries when a worker call fails", async () => {
    const firstApi = createWorkerApiMock({
      recalculateBalances: () => Promise.reject(new Error("worker failed")),
    });

    const secondApi = createWorkerApiMock();
    proxyMock.workerApis.push(firstApi, secondApi);
    const { repo, networkSubsystem } = createRepoMock();
    const { appWorker, initializeAppWorker } = createClient();

    await initializeAppWorker({
      repo,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: false,
    });

    await expect(appWorker.recalculateBalances(partyId)).resolves.toBe(true);
    expect(firstApi.recalculateBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        partyId,
        documents: [{ documentId: partyId, heads: expect.any(Array) }],
      }),
    );
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        partyId,
        documents: [{ documentId: partyId, heads: expect.any(Array) }],
      }),
    );
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
    const { appWorker, initializeAppWorker } = createClient();

    await expect(
      initializeAppWorker({
        repo,
        wssUrl: "wss://sync.example.test",
        isOfflineOnly: false,
      }),
    ).rejects.toThrow("worker init failed");

    await expect(appWorker.recalculateBalances(partyId)).resolves.toBe(true);
    expect(firstApi.recalculateBalances).not.toHaveBeenCalled();
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        partyId,
        documents: [{ documentId: partyId, heads: expect.any(Array) }],
      }),
    );
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

    const { appWorker, initializeAppWorker } = createClient();

    await initializeAppWorker({
      repo,
      wssUrl: "wss://sync.example.test",
      isOfflineOnly: false,
    });

    await expect(appWorker.recalculateBalances(partyId)).rejects.toThrow("worker still failed");

    expect(firstApi.recalculateBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        partyId,
        documents: [{ documentId: partyId, heads: expect.any(Array) }],
      }),
    );
    expect(secondApi.recalculateBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        partyId,
        documents: [{ documentId: partyId, heads: expect.any(Array) }],
      }),
    );
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
    // SAFETY: The previous assertions verify this is the full-restart CustomEvent emitted by the worker client.
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
  recalculateBalances = () => Promise.resolve([]),
}: {
  initialize?: InitializeWorker;
  recalculateBalances?: RecalculateBalances;
} = {}) {
  return {
    initialize: vi.fn<InitializeWorker>(initialize),
    recalculateBalances: vi.fn<RecalculateBalances>(recalculateBalances),
  };
}

let partyId: Party["id"];
const testRepos: Repo[] = [];

function createRepoMock() {
  const repo = new Repo({ network: [] });
  testRepos.push(repo);

  const party = repo.create<Party>({
    // SAFETY: Repo.create replaces the initial placeholder with its allocated document ID immediately below.
    id: "" as Party["id"],
    type: "party",
    name: "Test party",
    description: "",
    currency: "EUR",
    participants: {},
    chunkRefs: [],
  });

  party.change((doc) => {
    doc.id = party.documentId;
  });
  partyId = party.documentId;

  const addNetworkAdapter = vi
    .spyOn(repo.networkSubsystem, "addNetworkAdapter")
    .mockImplementation(() => {});

  const removeNetworkAdapter = vi
    .spyOn(repo.networkSubsystem, "removeNetworkAdapter")
    .mockImplementation(() => {});

  return {
    networkSubsystem: { addNetworkAdapter, removeNetworkAdapter },
    repo,
  };
}
