/**
 * Balance synchronization utilities.
 *
 * Provides functions for recalculating and updating chunk balances.
 */

import type { DocumentId } from "../../types.js";
import type { ITrizumClient } from "../../client.js";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
} from "../../models/party.js";
import type { Expense } from "../../models/expense.js";
import { calculateBalancesByParticipant } from "../../calculations/balance.js";
import { diff, type DiffResult } from "@opentf/obj-diff";
import { clone } from "@opentf/std";

/**
 * Recalculate and update balances for a single chunk.
 */
export async function recalculateChunkBalances(
  client: ITrizumClient,
  balancesId: DocumentId,
  expenses: Expense[],
  participants: Party["participants"],
): Promise<void> {
  const balancesHandle =
    await client.findHandle<PartyExpenseChunkBalances>(balancesId);
  const balances = balancesHandle.doc();

  if (!balances) {
    throw new Error("Chunk balances not found");
  }

  const newBalances = calculateBalancesByParticipant(expenses, participants);

  balancesHandle.change((doc: PartyExpenseChunkBalances) => {
    // Apply patches for minimal CRDT changes
    const patches = diff(clone(doc.balances), clone(newBalances));
    applyPatches(doc.balances as Record<string, unknown>, patches);
  });
}

/**
 * Recalculate balances for all chunks in a party.
 */
export async function recalculateAllChunkBalances(
  client: ITrizumClient,
  partyId: DocumentId,
): Promise<void> {
  const partyHandle = await client.findHandle<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  for (const chunkRef of party.chunkRefs) {
    const chunkHandle = await client.findHandle<PartyExpenseChunk>(
      chunkRef.chunkId,
    );
    const chunk = chunkHandle.doc();

    if (!chunk) {
      throw new Error("Chunk not found");
    }

    await recalculateChunkBalances(
      client,
      chunkRef.balancesId,
      chunk.expenses,
      party.participants,
    );
  }
}

/**
 * Apply diff patches to an object.
 */
function applyPatches(
  target: Record<string, unknown>,
  patches: DiffResult[],
): void {
  for (const patch of patches) {
    applyPatch(target, patch);
  }
}

/**
 * Apply a single patch to an object.
 * DiffResult.t: 0 = Add, 1 = Update, 2 = Remove
 */
function applyPatch(target: Record<string, unknown>, patch: DiffResult): void {
  const path = patch.p;
  let current: unknown = target;

  // Navigate to parent
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if ((current as Record<string | number, unknown>)[key] === undefined) {
      (current as Record<string | number, unknown>)[key] = {};
    }
    current = (current as Record<string | number, unknown>)[key];
  }

  const lastKey = path[path.length - 1];
  const parent = current as Record<string | number, unknown>;

  switch (patch.t) {
    case 0: // Add
    case 1: // Update
      parent[lastKey] = patch.v;
      break;
    case 2: // Remove
      delete parent[lastKey];
      break;
  }
}
