/**
 * Chunk-based pagination utilities.
 *
 * These pure functions help manage paginated loading of expenses
 * from party expense chunks.
 */

import type { DocumentId } from "../types.js";
import type { Party, PartyExpenseChunk } from "../models/party.js";
import type { Expense } from "../models/expense.js";
import type { ChunkPaginationState, PaginatedExpenses } from "./types.js";

/**
 * Create initial pagination state from a party.
 *
 * @param party - The party containing chunk references
 * @param loadedChunkIds - IDs of chunks already loaded (default: empty)
 * @returns The pagination state
 */
export function createChunkPagination(
  party: Party,
  loadedChunkIds: DocumentId[] = [],
): ChunkPaginationState {
  // Chunk refs are ordered oldest to newest, we want newest first
  const allChunkIds = [...party.chunkRefs].reverse().map((ref) => ref.chunkId);

  const loadedSet = new Set(loadedChunkIds);
  const availableChunkIds = allChunkIds.filter((id) => !loadedSet.has(id));

  return {
    loadedChunkIds,
    availableChunkIds,
    hasMore: availableChunkIds.length > 0,
    totalChunks: allChunkIds.length,
    loadedChunks: loadedChunkIds.length,
  };
}

/**
 * Get the next chunk IDs to load for pagination.
 *
 * @param party - The party containing chunk references
 * @param loadedChunkIds - IDs of chunks already loaded
 * @param count - Number of chunks to get (default: 1)
 * @returns Array of chunk IDs to load next
 */
export function getNextChunkIds(
  party: Party,
  loadedChunkIds: DocumentId[],
  count: number = 1,
): DocumentId[] {
  const pagination = createChunkPagination(party, loadedChunkIds);
  return pagination.availableChunkIds.slice(0, count);
}

/**
 * Collect all expenses from loaded chunks.
 * Expenses are returned in order (newest first within each chunk,
 * with newer chunks before older chunks).
 *
 * @param chunks - Array of loaded expense chunks
 * @returns All expenses from the chunks
 */
export function collectExpensesFromChunks(
  chunks: PartyExpenseChunk[],
): Expense[] {
  // Sort chunks by creation date (newest first)
  const sortedChunks = [...chunks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Collect all expenses (each chunk's expenses are already newest first)
  return sortedChunks.flatMap((chunk) => chunk.expenses);
}

/**
 * Update pagination state after loading new chunks.
 *
 * @param party - The party containing chunk references
 * @param previousState - The previous pagination state
 * @param newlyLoadedChunkIds - IDs of chunks that were just loaded
 * @returns Updated pagination state
 */
export function updatePaginationAfterLoad(
  party: Party,
  previousState: ChunkPaginationState,
  newlyLoadedChunkIds: DocumentId[],
): ChunkPaginationState {
  const allLoadedIds = [
    ...previousState.loadedChunkIds,
    ...newlyLoadedChunkIds,
  ];
  return createChunkPagination(party, allLoadedIds);
}

/**
 * Check if the initial chunk needs to be loaded.
 * The initial chunk is the most recent (newest) chunk.
 *
 * @param party - The party to check
 * @param loadedChunkIds - Currently loaded chunk IDs
 * @returns true if the initial chunk needs loading
 */
export function needsInitialChunkLoad(
  party: Party,
  loadedChunkIds: DocumentId[],
): boolean {
  if (party.chunkRefs.length === 0) {
    return false;
  }

  // Get the newest chunk ID (last in the array since refs are oldest to newest)
  const newestChunkId = party.chunkRefs[party.chunkRefs.length - 1].chunkId;
  return !loadedChunkIds.includes(newestChunkId);
}

/**
 * Get the initial chunk ID to load.
 *
 * @param party - The party containing chunk references
 * @returns The newest chunk ID, or undefined if no chunks exist
 */
export function getInitialChunkId(party: Party): DocumentId | undefined {
  if (party.chunkRefs.length === 0) {
    return undefined;
  }

  // Return the newest chunk (last in the array)
  return party.chunkRefs[party.chunkRefs.length - 1].chunkId;
}

/**
 * Create a paginated expenses result from chunks.
 *
 * @param party - The party containing chunk references
 * @param chunks - The loaded chunks
 * @returns Paginated expenses with pagination state
 */
export function createPaginatedExpenses(
  party: Party,
  chunks: PartyExpenseChunk[],
): PaginatedExpenses {
  const loadedChunkIds = chunks.map((chunk) => chunk.id);
  const expenses = collectExpensesFromChunks(chunks);
  const pagination = createChunkPagination(party, loadedChunkIds);

  return {
    expenses,
    pagination,
  };
}
