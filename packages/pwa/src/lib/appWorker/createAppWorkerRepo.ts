import { Repo } from "@automerge/automerge-repo";
import type { NetworkAdapterInterface } from "@automerge/automerge-repo/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import type { AppWorkerInitializeOptions } from "./proxy.ts";

export function createAppWorkerRepo(options: AppWorkerInitializeOptions) {
  const network: NetworkAdapterInterface[] = [new MessageChannelNetworkAdapter(options.repoPort)];

  if (!options.isOfflineOnly) {
    network.push(new BrowserWebSocketClientAdapter(options.wssUrl));
  }

  return new Repo({
    storage: new IndexedDBStorageAdapter("trizum"),
    network,
  });
}
