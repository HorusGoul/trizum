/**
 * Web Worker entry point for running the document repository in a background thread.
 *
 * This file re-exports the SDK's worker implementation.
 * Vite will bundle this as a separate worker module.
 */

// Re-export the SDK's worker implementation
// The SDK's repo-worker.ts sets up the message handlers and creates the Repo
export * from "@trizum/sdk/worker/repo-worker";
