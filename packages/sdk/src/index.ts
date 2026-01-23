/**
 * Trizum SDK - Public API
 *
 * This is the main entry point for the Trizum SDK.
 * All types and functions are SDK-specific and do not expose Automerge internals.
 */

// Core client
export { TrizumClient, type TrizumClientOptions } from "./client.js";

// Web Worker client
export {
  TrizumWorkerClient,
  type TrizumWorkerClientOptions,
} from "./worker/index.js";

// Worker message types (for custom worker implementations)
export type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerConfig,
} from "./worker/index.js";

// Internal repo type (needed for backwards compatibility during migration)
// NOTE: This is an opaque type - consumers should not depend on Automerge internals
export type {
  Repo,
  AMDocHandle as DocHandle,
  AutomergeAnyDocumentId,
} from "./internal/automerge.js";

// RawString class for creating immutable string values in documents
// wrapHandle function to convert Automerge DocHandle to SDK DocumentHandle
export { RawString, wrapHandle } from "./internal/automerge.js";

// React context and hooks
export {
  TrizumProvider,
  useTrizumClient,
  useRepo,
  RepoContext,
} from "./react/TrizumProvider.js";

// React suspense hooks
export {
  useSuspenseDocument,
  useSuspenseHandle,
  useMultipleSuspenseDocuments,
  type UseSuspenseDocumentOptions,
} from "./react/suspense-hooks.js";

export { useDocument, type UseDocumentResult } from "./react/useDocument.js";

// Retry utilities
export {
  retryWithExponentialBackoff,
  RetryAbortedError,
  MaxRetriesExceededError,
  type RetryOptions,
} from "./utils/retry.js";

// Array utilities for document mutations
export { insertAt, deleteAt } from "./utils/array.js";

// Core types (SDK-specific, no Automerge exposure)
export type {
  DocumentId,
  DocumentHandle,
  SupportedLocale,
  CurrencyCode,
} from "./types.js";
export { SUPPORTED_LOCALES } from "./types.js";
export { isValidDocumentId } from "./internal/automerge.js";

// Model types
export type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "./models/types.js";

// Domain models
export type {
  // Party
  Party,
  PartyParticipant,
  PartyExpenseChunk,
  PartyExpenseChunkRef,
  PartyExpenseChunkBalances,
  BalancesSortedBy,
  CreatePartyInput,
  // Party List
  PartyList,
  UpdatePartyListInput,
  // Expense
  Expense,
  ExpenseUser,
  ExpenseShare,
  ExpenseShareExact,
  ExpenseShareDivide,
  Balance,
  BalancesByParticipant,
  SimplifiedTransaction,
  // Media
  MediaFile,
} from "./models/index.js";

// Domain helpers
export {
  // Party
  getActiveParticipants,
  getArchivedParticipants,
  PARTY_LIST_STORAGE_KEY,
  // Expense
  getExpenseTotalAmount,
  createExpenseId,
  decodeExpenseId,
  findExpenseById,
  simplifyBalanceTransactions,
  mergeBalancesByParticipant,
  // Media
  encodeBlob,
  decodeBlob,
} from "./models/index.js";

// Internal cache (marked as internal but exported for backwards compatibility)
export {
  documentCache,
  handleCache,
  multipleDocumentCache,
  type AnyDocumentId,
} from "./cache/document-cache.js";
