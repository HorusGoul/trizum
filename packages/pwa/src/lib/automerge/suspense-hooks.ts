/**
 * Re-exports from @trizum/sdk for backwards compatibility.
 *
 * This file now delegates all suspense hook functionality to the SDK,
 * keeping the existing API for existing code in the PWA.
 */

// Re-export everything from the SDK
export {
  // Cache utilities
  cache,
  multiCache,
  // Retry utilities
  retryWithExponentialBackoff,
  // React hooks - note: useMultipleSuspenseDocuments is renamed for backwards compatibility
  useSuspenseHandle,
  useSuspenseDocument,
  useMultipleSuspenseDocuments as useMultipleSuspenseDocument,
} from "@trizum/sdk";
