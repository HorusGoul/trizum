/**
 * Web Worker support for Trizum SDK.
 *
 * This module provides utilities for running document repository in a Web Worker,
 * offloading heavy operations to a background thread.
 *
 * Architecture:
 * - WorkerCache: In-memory cache in the worker thread (close to IndexedDB)
 * - UI Cache (client-cache.ts): React Suspense cache in main thread
 */

export {
  TrizumWorkerClient,
  type TrizumWorkerClientOptions,
} from "./worker-client.js";

export { WorkerCache } from "./worker-cache.js";

export type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerConfig,
} from "./types.js";
