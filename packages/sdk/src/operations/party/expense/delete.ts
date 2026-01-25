/**
 * Delete expense operation.
 */

import type { ITrizumClient } from "../../../client.js";
import type { DocumentId } from "../../../types.js";
import type { Party, PartyExpenseChunk } from "../../../models/party.js";
import type { Expense } from "../../../models/expense.js";
import { decodeExpenseId } from "../../../models/expense.js";
import { deleteAt } from "../../../utils/array.js";
import { recalculateChunkBalances } from "../../utils/balance-sync.js";

/**
 * Delete an expense from a party.
 *
 * Handles:
 * - Finding the correct chunk based on expense ID
 * - Removing the expense from the chunk
 * - Balance recalculation
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param expenseId - The expense ID to delete
 */
export async function deleteExpense(
  client: ITrizumClient,
  partyId: DocumentId,
  expenseId: Expense["id"],
): Promise<void> {
  const partyHandle = await client.findHandle<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  // Decode expense ID to find chunk
  const { chunkId } = decodeExpenseId(expenseId);

  const chunkRef = party.chunkRefs.find((ref) => ref.chunkId === chunkId);
  if (!chunkRef) {
    throw new Error("Chunk not found for expense");
  }

  const chunkHandle = await client.findHandle<PartyExpenseChunk>(
    chunkRef.chunkId,
  );
  const chunk = chunkHandle.doc();

  if (!chunk) {
    throw new Error("Chunk not found");
  }

  // Remove expense
  chunkHandle.change((doc: PartyExpenseChunk) => {
    const expenseIndex = doc.expenses.findIndex((e) => e.id === expenseId);

    if (expenseIndex === -1) {
      throw new Error("Expense not found in chunk");
    }

    deleteAt(doc.expenses, expenseIndex);
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
