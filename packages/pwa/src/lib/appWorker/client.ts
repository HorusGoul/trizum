import type { Repo } from "@automerge/automerge-repo/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import type { Party } from "#src/models/party.ts";
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
  worker: Worker;
}

let appWorkerClient: AppWorkerClient | null = null;

export function initializeAppWorker(options: InitializeAppWorkerOptions) {
  const client = getAppWorkerClient(options);

  return client.initializePromise;
}

export async function recalculatePartyBalancesInWorker(partyId: Party["id"]) {
  const client = requireAppWorkerClient();

  await client.initializePromise;

  return client.api.recalculateBalances(partyId);
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
    worker,
  };

  return appWorkerClient;
}

function requireAppWorkerClient() {
  if (!appWorkerClient) {
    throw new Error("App worker has not been initialized");
  }

  return appWorkerClient;
}
