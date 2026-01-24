/**
 * Update expense operation.
 */

import type { ITrizumClient } from "../../../client.js";
import type { DocumentId } from "../../../types.js";
import type {
  Party,
  PartyExpenseChunk,
} from "../../../models/party.js";
import type { Expense } from "../../../models/expense.js";
import { decodeExpenseId } from "../../../models/expense.js";
import { applyExpenseDiff } from "../../utils/expense-diff.js";
import { recalculateChunkBalances } from "../../utils/balance-sync.js";

/**
 * Update an existing expense in a party.
 *
 * Handles:
 * - Finding the correct chunk based on expense ID
 * - Applying diff-based updates for CRDT efficiency
 * - Clearing edit copy metadata
 * - Balance recalculation
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param expense - The updated expense (must include id)
 */
export async function updateExpense(
  client: ITrizumClient,
  partyId: DocumentId,
  expense: Expense,
): Promise<void> {
  const partyHandle = await client.findHandle<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  // Decode expense ID to find chunk
  const { chunkId } = decodeExpenseId(expense.id);

  const chunkRef = party.chunkRefs.find((ref) => ref.chunkId === chunkId);
  if (!chunkRef) {
    throw new Error("Chunk not found for expense");
  }

  const chunkHandle = await client.findHandle<PartyExpenseChunk>(chunkRef.chunkId);
  const chunk = chunkHandle.doc();

  if (!chunk) {
    throw new Error("Chunk not found");
  }

  // Apply update with diff
  chunkHandle.change((doc: PartyExpenseChunk) => {
    const existingExpense = doc.expenses.find((e) => e.id === expense.id);

    if (!existingExpense) {
      throw new Error("Expense not found in chunk");
    }

    applyExpenseDiff(existingExpense, expense);

    // Clear edit copy metadata
    delete existingExpense.__editCopy;
    delete existingExpense.__editCopyLastUpdatedAt;
  });

  const updatedChunk = chunkHandle.doc();
  if (!updatedChunk) {
    throw new Error("Chunk not found after update");
  }

  // Recalculate balances
  await recalculateChunkBalances(
    client,
    chunkRef.balancesId,
    updatedChunk.expenses,
    party.participants,
  );
}
