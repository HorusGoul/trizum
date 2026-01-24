/**
 * Pagination module for chunk-based expense loading.
 *
 * This module provides pure functions for managing paginated loading
 * of expenses from party expense chunks.
 */

// Types
export type { ChunkPaginationState, PaginatedExpenses } from "./types.js";

// Chunk iteration utilities
export {
  createChunkPagination,
  getNextChunkIds,
  collectExpensesFromChunks,
  updatePaginationAfterLoad,
  needsInitialChunkLoad,
  getInitialChunkId,
  createPaginatedExpenses,
} from "./chunk-iterator.js";
