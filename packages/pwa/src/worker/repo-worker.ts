/**
 * Web Worker entry point for running the document repository in a background thread.
 *
 * This worker receives a MessageChannel port from the main thread and uses it
 * to communicate document changes bidirectionally. The heavy document operations
 * run in this worker thread, keeping the main thread responsive.
 */

import { Repo, type NetworkAdapterInterface } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

// Worker global scope
declare const self: DedicatedWorkerGlobalScope;

interface WorkerConfig {
  storageName: string;
  syncUrl?: string | null;
  offlineOnly?: boolean;
}

type MainToWorkerMessage =
  | { type: "init"; config: WorkerConfig }
  | { type: "port"; port: MessagePort };

type WorkerToMainMessage =
  | { type: "initialized" }
  | { type: "ready" }
  | { type: "error"; error: string };

let _repo: Repo | null = null;
let config: WorkerConfig | null = null;

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init":
      config = message.config;
      break;

    case "port":
      if (!config) {
        postError("Received port before init config");
        return;
      }

      try {
        _repo = createWorkerRepo(config, message.port);
        postReady();
      } catch (error) {
        postError(
          error instanceof Error ? error.message : "Failed to create repo",
        );
      }
      break;
  }
};

// Signal that the worker is ready to receive messages
// This must happen after setting up onmessage to avoid race conditions
self.postMessage({ type: "initialized" } as WorkerToMainMessage);

function createWorkerRepo(config: WorkerConfig, port: MessagePort): Repo {
  const { storageName, syncUrl, offlineOnly = false } = config;

  const network: NetworkAdapterInterface[] = [];

  // Add WebSocket adapter for external sync if configured
  if (!offlineOnly && syncUrl) {
    network.push(new BrowserWebSocketClientAdapter(syncUrl));
  }

  // Add MessageChannel adapter for main thread communication
  network.push(new MessageChannelNetworkAdapter(port));

  return new Repo({
    storage: new IndexedDBStorageAdapter(storageName),
    network,
  });
}

function postReady(): void {
  const message: WorkerToMainMessage = { type: "ready" };
  self.postMessage(message);
}

function postError(error: string): void {
  const message: WorkerToMainMessage = { type: "error", error };
  self.postMessage(message);
}
