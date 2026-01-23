/**
 * Web Worker support for Trizum SDK.
 *
 * This module provides utilities for running document repository in a Web Worker,
 * offloading heavy operations to a background thread.
 */

export {
  TrizumWorkerClient,
  type TrizumWorkerClientOptions,
} from "./worker-client.js";

export type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerConfig,
} from "./types.js";
