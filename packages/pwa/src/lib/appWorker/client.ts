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

export const APP_WORKER_FULL_RESTART_REQUIRED_EVENT = "trizum:app-worker-full-restart-required";

export interface AppWorkerFullRestartRequiredEventDetail {
  methodName: string;
}

const logger = getLogger("appWorker", "client");
let appWorkerClient: AppWorkerClient | null = null;
let appWorkerOptions: InitializeAppWorkerOptions | null = null;
let isFullAppRestartRequired = false;

export const appWorker = new Proxy({} as AppWorkerClientApi, {
  get(_target, property) {
    if (typeof property !== "string" || property === "then") {
      return undefined;
    }

    return (...args: unknown[]) => {
      return callAppWorker(property, (api) => {
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

async function callAppWorker<Result>(
  methodName: string,
  call: (api: AppWorkerApi) => Promise<Result>,
) {
  if (isFullAppRestartRequired) {
    logger.warning("Skipping app worker method call because an app restart is required", {
      methodName,
    });
    notifyFullAppRestartRequired(methodName);
    throw new Error("App restart required before calling app worker");
  }

  const client = getAppWorkerClient(requireAppWorkerOptions());

  try {
    return await callAppWorkerApi(client, methodName, 1, call);
  } catch (error) {
    logger.warning("Restarting app worker after failed method call", {
      methodName,
      attempt: 1,
      error,
    });

    let restartedClient: AppWorkerClient | null = null;

    try {
      restartedClient = restartAppWorkerClient(client);
      const result = await callAppWorkerApi(restartedClient, methodName, 2, call);

      logger.info("App worker method call succeeded after restart", {
        methodName,
        attempt: 2,
      });

      return result;
    } catch (restartError) {
      logger.error("App worker method call failed after restart", {
        methodName,
        attempt: 2,
        error: restartError,
      });
      markFullAppRestartRequired(methodName);
      if (restartedClient) {
        clearAppWorkerClient(restartedClient);
      }
      throw restartError;
    }
  }
}

async function callAppWorkerApi<Result>(
  client: AppWorkerClient,
  methodName: string,
  attempt: number,
  call: (api: AppWorkerApi) => Promise<Result>,
) {
  const startedAt = getCurrentTime();

  logger.debug("App worker method call started", { methodName, attempt });

  try {
    await client.initializePromise;
    const result = await call(client.api);

    logger.debug("App worker method call succeeded", {
      methodName,
      attempt,
      durationMs: getDurationMs(startedAt),
    });

    return result;
  } catch (error) {
    logger.debug("App worker method call failed", {
      methodName,
      attempt,
      durationMs: getDurationMs(startedAt),
      error,
    });

    throw error;
  }
}

function restartAppWorkerClient(failedClient: AppWorkerClient) {
  if (appWorkerClient !== failedClient) {
    return getAppWorkerClient(requireAppWorkerOptions());
  }

  destroyAppWorkerClient(failedClient);
  appWorkerClient = null;

  return getAppWorkerClient(requireAppWorkerOptions());
}

function clearAppWorkerClient(client: AppWorkerClient) {
  if (appWorkerClient === client) {
    appWorkerClient = null;
  }

  destroyAppWorkerClient(client);
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

function markFullAppRestartRequired(methodName: string) {
  isFullAppRestartRequired = true;
  notifyFullAppRestartRequired(methodName);
}

function notifyFullAppRestartRequired(methodName: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppWorkerFullRestartRequiredEventDetail>(
      APP_WORKER_FULL_RESTART_REQUIRED_EVENT,
      {
        detail: { methodName },
      },
    ),
  );
}

function getCurrentTime() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function getDurationMs(startedAt: number) {
  return Math.round(Math.max(0, getCurrentTime() - startedAt));
}
