/**
 * Types for chunk-based pagination.
 */

import type { DocumentId } from "../types.js";
import type { Expense } from "../models/expense.js";

/**
 * State of chunk-based pagination.
 */
export interface ChunkPaginationState {
  /** IDs of chunks that have been loaded */
  loadedChunkIds: DocumentId[];
  /** IDs of chunks that are available but not yet loaded */
  availableChunkIds: DocumentId[];
  /** Whether there are more chunks to load */
  hasMore: boolean;
  /** Total number of chunks available */
  totalChunks: number;
  /** Number of chunks loaded */
  loadedChunks: number;
}

/**
 * Paginated expenses result.
 */
export interface PaginatedExpenses {
  /** The expenses from loaded chunks */
  expenses: Expense[];
  /** Pagination state */
  pagination: ChunkPaginationState;
}
