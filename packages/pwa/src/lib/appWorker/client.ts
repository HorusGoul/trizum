import type { Repo } from "@automerge/automerge-repo/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { getLogger } from "#src/lib/log.ts";
import { WorkerAdapter } from "./WorkerAdapter.ts";
import { injectAppWorker, type AppWorkerApi } from "./proxy.ts";

export interface InitializeAppWorkerOptions {
  repo: Repo;
  wssUrl: string;
  isOfflineOnly: boolean;
}

interface AppWorkerClient {
  api: AppWorkerApi;
  initializePromise: Promise<void>;
  options: InitializeAppWorkerOptions;
  repoNetworkAdapter: MessageChannelNetworkAdapter;
  repoPort: MessagePort;
  worker: Worker;
}

type AppWorkerClientApi = Omit<AppWorkerApi, "initialize">;

const logger = getLogger("appWorker", "client");
let appWorkerClient: AppWorkerClient | null = null;
let appWorkerOptions: InitializeAppWorkerOptions | null = null;

export const appWorker = new Proxy({} as AppWorkerClientApi, {
  get(_target, property) {
    if (typeof property !== "string" || property === "then") {
      return undefined;
    }

    return (...args: unknown[]) => {
      return callAppWorker((api) => {
        const method = api[property as keyof AppWorkerClientApi];

        if (typeof method !== "function") {
          throw new Error(`App worker method ${property} is not available`);
        }

        return (method as (...args: unknown[]) => Promise<unknown>).apply(api, args);
      });
    };
  },
});

export function initializeAppWorker(options: InitializeAppWorkerOptions) {
  appWorkerOptions = options;
  const client = getAppWorkerClient(options);

  return client.initializePromise;
}

function getAppWorkerClient({ repo, wssUrl, isOfflineOnly }: InitializeAppWorkerOptions) {
  if (appWorkerClient) {
    return appWorkerClient;
  }

  if (typeof Worker === "undefined") {
    throw new Error("App worker is not available in this environment");
  }

  const worker = new Worker(new URL("./appWorker.entrypoint.ts", import.meta.url), {
    type: "module",
  });
  const api = injectAppWorker(new WorkerAdapter(worker, "app-worker-injector"));
  const repoChannel = new MessageChannel();
  const repoNetworkAdapter = new MessageChannelNetworkAdapter(repoChannel.port1);

  repo.networkSubsystem.addNetworkAdapter(repoNetworkAdapter);

  const initializePromise = api.initialize({
    repoPort: repoChannel.port2,
    wssUrl,
    isOfflineOnly,
  });

  appWorkerClient = {
    api,
    initializePromise,
    options: { repo, wssUrl, isOfflineOnly },
    repoNetworkAdapter,
    repoPort: repoChannel.port1,
    worker,
  };

  return appWorkerClient;
}

async function callAppWorker<Result>(call: (api: AppWorkerApi) => Promise<Result>) {
  const client = getAppWorkerClient(requireAppWorkerOptions());

  try {
    return await callAppWorkerApi(client, call);
  } catch (error) {
    logger.warning("Restarting app worker after failed call", { error });

    const restartedClient = restartAppWorkerClient(client);

    return callAppWorkerApi(restartedClient, call);
  }
}

async function callAppWorkerApi<Result>(
  client: AppWorkerClient,
  call: (api: AppWorkerApi) => Promise<Result>,
) {
  await client.initializePromise;

  return call(client.api);
}

function restartAppWorkerClient(failedClient: AppWorkerClient) {
  if (appWorkerClient !== failedClient) {
    return getAppWorkerClient(requireAppWorkerOptions());
  }

  destroyAppWorkerClient(failedClient);
  appWorkerClient = null;

  return getAppWorkerClient(requireAppWorkerOptions());
}

function destroyAppWorkerClient(client: AppWorkerClient) {
  try {
    client.options.repo.networkSubsystem.removeNetworkAdapter(client.repoNetworkAdapter);
  } finally {
    client.repoPort.close();
    client.worker.terminate();
  }
}

function requireAppWorkerOptions() {
  if (!appWorkerOptions) {
    throw new Error("App worker has not been initialized");
  }

  return appWorkerOptions;
}
