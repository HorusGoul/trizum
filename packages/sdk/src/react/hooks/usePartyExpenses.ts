/**
 * SDK React hook for paginated party expenses.
 *
 * Provides lazy-loading of expenses across chunks.
 */

import { useState, useCallback, useTransition, useMemo } from "react";
import { useTrizumClient } from "../TrizumProvider.js";
import {
  useSuspenseDocument,
  useMultipleSuspenseDocuments,
} from "../suspense-hooks.js";
import type { DocumentId } from "../../types.js";
import type { Party, PartyExpenseChunk } from "../../models/party.js";
import type { Expense } from "../../models/expense.js";

/**
 * Result of usePartyExpenses hook.
 */
export interface UsePartyExpensesResult {
  /** All loaded expenses (merged from all loaded chunks) */
  expenses: Expense[];
  /** Whether more chunks are being loaded */
  isLoadingNext: boolean;
  /** Whether there are more chunks to load */
  hasNext: boolean;
  /** Load the next chunk */
  loadNext: () => void;
}

/**
 * Hook for paginated expense loading.
 *
 * This hook:
 * 1. Loads chunks progressively (one at a time)
 * 2. Merges expenses from all loaded chunks
 * 3. Subscribes to changes on all loaded chunks for real-time updates
 *
 * @example
 * ```tsx
 * function ExpenseListView({ partyId }: { partyId: DocumentId }) {
 *   const { expenses, hasNext, loadNext, isLoadingNext } = usePartyExpenses(partyId);
 *
 *   return (
 *     <div>
 *       <ul>
 *         {expenses.map((expense) => (
 *           <li key={expense.id}>{expense.name}</li>
 *         ))}
 *       </ul>
 *       {hasNext && (
 *         <button onClick={loadNext} disabled={isLoadingNext}>
 *           {isLoadingNext ? "Loading..." : "Load More"}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePartyExpenses(partyId: DocumentId): UsePartyExpensesResult {
  const _client = useTrizumClient();
  const [party] = useSuspenseDocument<Party>(partyId, { required: true });
  const [loadedChunkCount, setLoadedChunkCount] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Get the IDs of chunks we want to load
  const chunkIdsToLoad = useMemo(() => {
    return party.chunkRefs.slice(0, loadedChunkCount).map((ref) => ref.chunkId);
  }, [party.chunkRefs, loadedChunkCount]);

  // Load all chunks we want
  const chunks =
    useMultipleSuspenseDocuments<PartyExpenseChunk>(chunkIdsToLoad);

  // Merge expenses from all loaded chunks
  const expenses = useMemo(() => {
    const allExpenses: Expense[] = [];
    for (const item of chunks) {
      if (item.doc?.expenses) {
        allExpenses.push(...item.doc.expenses);
      }
    }
    return allExpenses;
  }, [chunks]);

  // Check if there are more chunks to load
  const hasNext = loadedChunkCount < party.chunkRefs.length;

  // Load the next chunk
  const loadNext = useCallback(() => {
    if (!hasNext) return;

    startTransition(() => {
      setLoadedChunkCount((count) => count + 1);
    });
  }, [hasNext]);

  return {
    expenses,
    isLoadingNext: isPending,
    hasNext,
    loadNext,
  };
}
