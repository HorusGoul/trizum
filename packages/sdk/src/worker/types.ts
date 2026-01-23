/**
 * Types for Web Worker communication.
 *
 * These types define the message protocol between the main thread
 * and the Web Worker that runs the document repository.
 */

/**
 * Messages sent from the main thread to the worker.
 */
export type MainToWorkerMessage =
  | { type: "init"; config: WorkerConfig }
  | { type: "port"; port: MessagePort };

/**
 * Messages sent from the worker to the main thread.
 */
export type WorkerToMainMessage =
  | { type: "ready" }
  | { type: "error"; error: string };

/**
 * Configuration for the Web Worker.
 */
export interface WorkerConfig {
  storageName: string;
  syncUrl?: string | null;
  offlineOnly?: boolean;
}
