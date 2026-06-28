import type { Repo } from "@automerge/automerge-repo/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { getAutomergeWssUrl, getIsAutomergeOfflineOnly } from "#src/lib/automerge/syncConfig.ts";
import type { Party } from "#src/models/party.ts";
import { WorkerAdapter } from "./WorkerAdapter.ts";
import { injectAppWorker, type AppWorkerApi } from "./proxy.ts";

interface AppWorkerClient {
  api: AppWorkerApi;
  initializePromise: Promise<void>;
  worker: Worker;
}

const clientsByRepo = new WeakMap<Repo, AppWorkerClient>();

export async function recalculatePartyBalancesInWorker(repo: Repo, partyId: Party["id"]) {
  const client = getAppWorkerClient(repo);
  await client.initializePromise;

  return client.api.recalculateBalances(partyId);
}

function getAppWorkerClient(repo: Repo): AppWorkerClient {
  const existingClient = clientsByRepo.get(repo);

  if (existingClient) {
    return existingClient;
  }

  if (typeof Worker === "undefined") {
    throw new Error("App worker is not available in this environment");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  const api = injectAppWorker(new WorkerAdapter(worker, "app-worker-injector"));
  const repoChannel = new MessageChannel();
  const repoNetworkAdapter = new MessageChannelNetworkAdapter(repoChannel.port1);

  repo.networkSubsystem.addNetworkAdapter(repoNetworkAdapter);

  const initializePromise = api.initialize({
    repoPort: repoChannel.port2,
    wssUrl: getAutomergeWssUrl(),
    isOfflineOnly: getIsAutomergeOfflineOnly(),
  });

  const client = {
    api,
    initializePromise,
    worker,
  };
  clientsByRepo.set(repo, client);

  return client;
}
