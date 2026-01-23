// Core exports
export { TrizumClient, type TrizumClientOptions } from "./client.js";
export {
  TrizumProvider,
  useTrizumClient,
  useRepo,
  RepoContext,
} from "./react/TrizumProvider.js";

// React hooks
export {
  useSuspenseDocument,
  useSuspenseHandle,
  useMultipleSuspenseDocuments,
  type UseSuspenseDocumentOptions,
} from "./react/suspense-hooks.js";
export { useDocument, type UseDocumentResult } from "./react/useDocument.js";

// Cache utilities
export {
  documentCache,
  handleCache,
  multipleDocumentCache,
} from "./cache/document-cache.js";

// Retry utilities
export {
  retryWithExponentialBackoff,
  RetryAbortedError,
  MaxRetriesExceededError,
  type RetryOptions,
} from "./utils/retry.js";

// Type exports
export type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "./models/types.js";
export type {
  DocumentId,
  AnyDocumentId,
  Doc,
  DocHandle,
  Repo,
} from "./types.js";
