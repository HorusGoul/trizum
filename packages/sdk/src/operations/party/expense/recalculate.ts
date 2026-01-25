/**
 * Recalculate balances operation.
 */

import type { ITrizumClient } from "../../../client.js";
import type { DocumentId } from "../../../types.js";
import { recalculateAllChunkBalances } from "../../utils/balance-sync.js";

/**
 * Recalculate all balances for a party.
 *
 * This recalculates the balances for all chunks in the party.
 * Useful for fixing inconsistencies or after bulk operations.
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 */
export async function recalculateAllBalances(
  client: ITrizumClient,
  partyId: DocumentId,
): Promise<void> {
  await recalculateAllChunkBalances(client, partyId);
}
