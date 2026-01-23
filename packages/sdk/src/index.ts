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

// React context and hooks
export { TrizumProvider, useTrizumClient } from "./react/TrizumProvider.js";

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
  DocumentChangePayload,
  EphemeralMessagePayload,
} from "./types.js";
export { SUPPORTED_LOCALES, isValidDocumentId } from "./types.js";

// ImmutableString class for creating immutable string values in documents
// This wraps Automerge's RawString without exposing the underlying implementation
export { ImmutableString } from "./utils/immutable-string.js";
export type { ImmutableString as ImmutableStringType } from "./utils/immutable-string.js";

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

// Cache utilities (SDK-specific, uses TrizumClient)
export { cache, multiCache } from "./cache/client-cache.js";
