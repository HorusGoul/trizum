/**
 * Web Worker entry point for running document repository in a background thread.
 *
 * This worker receives a MessageChannel port from the main thread and uses it
 * to communicate document changes bidirectionally. The heavy document operations
 * run in this worker thread, keeping the main thread responsive.
 *
 * Usage (from main thread):
 * ```ts
 * const worker = new Worker(new URL('./worker/repo-worker.js', import.meta.url), { type: 'module' });
 * const { port1, port2 } = new MessageChannel();
 *
 * worker.postMessage({ type: 'init', config: { storageName: 'trizum', syncUrl: 'wss://...' } });
 * worker.postMessage({ type: 'port', port: port2 }, [port2]);
 *
 * // Use port1 with MessageChannelNetworkAdapter on main thread
 * ```
 */

import {
  Repo,
  type NetworkAdapterInterface,
  BrowserWebSocketClientAdapter,
  IndexedDBStorageAdapter,
  MessageChannelNetworkAdapter,
} from "../internal/crdt.js";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerConfig,
} from "./types.js";

// Worker global scope
declare const self: DedicatedWorkerGlobalScope;

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

// Export for type checking (this module is meant to run as a worker)
export type { MainToWorkerMessage, WorkerToMainMessage };
