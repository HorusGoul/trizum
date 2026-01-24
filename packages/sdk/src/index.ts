/**
 * Trizum SDK - Public API
 *
 * This is the main entry point for the Trizum SDK.
 * All types and functions are SDK-specific and do not expose internal implementation details.
 */

// Core client
export {
  TrizumClient,
  type TrizumClientOptions,
  type ITrizumClient,
} from "./client.js";

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

// Core types
export type {
  DocumentId,
  AnyDocumentId,
  DocumentHandle,
  SupportedLocale,
  CurrencyCode,
  DocumentChangePayload,
  EphemeralMessagePayload,
} from "./types.js";
export { SUPPORTED_LOCALES, isValidDocumentId } from "./types.js";

// ImmutableString class for creating immutable string values in documents
export { ImmutableString } from "./utils/immutable-string.js";
export type { ImmutableString as ImmutableStringType } from "./utils/immutable-string.js";

// Model types
export type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "./models/types.js";

// Versioning
export type { VersionedModel } from "./models/versioned.js";
export {
  SDK_SCHEMA_VERSION,
  needsMigration,
  isFromNewerSdk,
} from "./models/versioned.js";

// Migration
export {
  VersionMismatchError,
  MigrationError,
  NoMigrationPathError,
  registerMigration,
  getMigration,
  getMigrationsForModel,
  getMigrationChain,
  hasMigrationPath,
  clearMigrations,
  getRegisteredModelTypes,
  migrateDocument,
  migrateIfNeeded,
  setSchemaVersion,
  type Migration,
  type MigrationFn,
  type MigrationResult,
  type MigrateDocumentOptions,
} from "./migration/index.js";

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

// Calculations
export {
  calculateLogStatsBetweenTwoUsers,
  calculateLogStatsOfUser,
  convertToUnits,
  exportIntoInput,
  getExpenseUnitShares,
  calculateBalancesByParticipant,
  getImpactOnBalanceForUser,
  type ExpenseInput,
  type UserDiff,
  type UserStats,
} from "./calculations/index.js";

// Validation
export {
  // Common utilities
  composeValidators,
  required,
  maxLength,
  minLength,
  positive,
  nonNegative,
  createValidator,
  type ValidationResult,
  type Validator,
  // Error keys
  PARTY_TITLE_REQUIRED,
  PARTY_TITLE_TOO_LONG,
  PARTY_DESCRIPTION_TOO_LONG,
  PARTICIPANT_NAME_REQUIRED,
  PARTICIPANT_NAME_TOO_LONG,
  PHONE_NUMBER_TOO_LONG,
  EXPENSE_TITLE_REQUIRED,
  EXPENSE_TITLE_TOO_LONG,
  EXPENSE_AMOUNT_REQUIRED,
  EXPENSE_AMOUNT_INVALID,
  DOCUMENT_ID_REQUIRED,
  DOCUMENT_ID_INVALID,
  type ValidationErrorKey,
  // Validators
  validatePartyTitle,
  validatePartyDescription,
  validateParticipantName,
  validatePhoneNumber,
  validateExpenseTitle,
  validateExpenseAmount,
  validateDocumentId,
  // Constants
  MAX_PARTY_TITLE_LENGTH,
  MAX_PARTY_DESCRIPTION_LENGTH,
  MAX_PARTICIPANT_NAME_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
} from "./validation/index.js";

// Pagination
export {
  createChunkPagination,
  getNextChunkIds,
  collectExpensesFromChunks,
  updatePaginationAfterLoad,
  needsInitialChunkLoad,
  getInitialChunkId,
  createPaginatedExpenses,
  type ChunkPaginationState,
  type PaginatedExpenses,
} from "./pagination/index.js";

// Cache utilities (SDK-specific, uses TrizumClient)
export { cache, multiCache } from "./cache/client-cache.js";
