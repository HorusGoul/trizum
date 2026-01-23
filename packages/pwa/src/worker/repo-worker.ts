/**
 * Web Worker entry point for running the document repository in a background thread.
 *
 * This file imports the SDK's worker implementation which sets up the message handlers.
 * Vite will bundle this as a separate worker module.
 */

// Import the SDK's worker implementation to run its side effects.
// The SDK's repo-worker.ts sets up self.onmessage when the module loads.
import "@trizum/sdk/worker/repo-worker";
