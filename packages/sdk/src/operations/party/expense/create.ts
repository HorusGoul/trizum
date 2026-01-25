/**
 * Create expense operation.
 */

import type { ITrizumClient } from "../../../client.js";
import type { DocumentId } from "../../../types.js";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
  PartyExpenseChunkRef,
} from "../../../models/party.js";
import type { Expense } from "../../../models/expense.js";
import { createExpenseId } from "../../../models/expense.js";
import { ulid } from "ulidx";
import { insertAt } from "../../../utils/array.js";
import { calculateExpenseHash } from "../../utils/expense-hash.js";
import { recalculateChunkBalances } from "../../utils/balance-sync.js";
import {
  validateExpensePaidBy,
  validateExpenseShares,
} from "../../../validation/index.js";

/**
 * Input for creating an expense.
 */
export type CreateExpenseInput = Omit<Expense, "id" | "__hash">;

/**
 * Create a new expense in a party.
 *
 * Handles:
 * - Chunk management (creates new chunk if current is full)
 * - Expense ID generation
 * - Hash calculation
 * - Balance recalculation
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param input - The expense data (without id and hash)
 * @returns The created expense with id and hash
 */
export async function createExpense(
  client: ITrizumClient,
  partyId: DocumentId,
  input: CreateExpenseInput,
): Promise<Expense> {
  // Validate that paidBy amounts are integers (cents)
  const paidByError = validateExpensePaidBy(input.paidBy);
  if (paidByError) {
    throw new Error(
      `Invalid paidBy amounts: values must be integers (cents). Got non-integer value. Error: ${paidByError}`,
    );
  }

  // Validate that share values are integers
  const sharesError = validateExpenseShares(input.shares);
  if (sharesError) {
    throw new Error(
      `Invalid share values: values must be integers. Got non-integer value. Error: ${sharesError}`,
    );
  }

  const partyHandle = await client.findHandle<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  // Get or create the last chunk (most recent is at index 0)
  let lastChunkRef = party.chunkRefs.at(0);
  let needsNewChunk = false;

  if (lastChunkRef) {
    const lastChunkHandle = await client.findHandle<PartyExpenseChunk>(
      lastChunkRef.chunkId,
    );
    const lastChunk = lastChunkHandle.doc();

    if (lastChunk && lastChunk.expenses.length >= lastChunk.maxSize) {
      needsNewChunk = true;
    }
  } else {
    needsNewChunk = true;
  }

  if (needsNewChunk) {
    // Create a new chunk
    const { id: chunkId } = client.create<PartyExpenseChunk>({
      type: "expenseChunk",
      createdAt: new Date(),
      expenses: [],
      maxSize: 500,
      partyId,
    });

    const { id: balancesId } = client.create<PartyExpenseChunkBalances>({
      type: "expenseChunkBalances",
      balances: {},
      partyId,
    });

    lastChunkRef = {
      chunkId,
      createdAt: new Date(),
      balancesId,
    };

    // Add new chunk ref to party
    partyHandle.change((doc: Party) => {
      insertAt(doc.chunkRefs, 0, lastChunkRef as PartyExpenseChunkRef);
    });
  }

  if (!lastChunkRef) {
    throw new Error("Failed to get or create chunk");
  }

  // Create expense with ID and hash
  const expenseWithId = {
    ...input,
    id: createExpenseId(lastChunkRef.chunkId, ulid),
  };

  const expense: Expense = {
    ...expenseWithId,
    __hash: calculateExpenseHash(expenseWithId),
  };

  // Add expense to chunk
  const chunkHandle = await client.findHandle<PartyExpenseChunk>(
    lastChunkRef.chunkId,
  );

  chunkHandle.change((doc: PartyExpenseChunk) => {
    insertAt(doc.expenses, 0, expense);
  });

  const updatedChunk = chunkHandle.doc();
  if (!updatedChunk) {
    throw new Error("Chunk not found after update");
  }

  // Recalculate balances
  await recalculateChunkBalances(
    client,
    lastChunkRef.balancesId,
    updatedChunk.expenses,
    party.participants,
  );

  return expense;
}
