/**
 * SDK React hook for party balances.
 *
 * Aggregates balances across all expense chunks.
 */

import { useSuspenseDocument, useMultipleSuspenseDocuments } from "../suspense-hooks.js";
import type { DocumentId } from "../../types.js";
import type { Party, PartyExpenseChunkBalances } from "../../models/party.js";
import type { BalancesByParticipant } from "../../models/expense.js";
import { mergeBalancesByParticipant } from "../../models/expense.js";

/**
 * Hook for getting merged balances across all chunks in a party.
 *
 * This hook:
 * 1. Loads the party document
 * 2. Loads all chunk balance documents
 * 3. Merges them into a single BalancesByParticipant object
 * 4. Ensures all participants have balance entries
 *
 * @example
 * ```tsx
 * function BalancesView({ partyId }: { partyId: DocumentId }) {
 *   const balances = usePartyBalances(partyId);
 *
 *   return (
 *     <ul>
 *       {Object.entries(balances).map(([id, balance]) => (
 *         <li key={id}>
 *           {id}: {balance.stats.balance}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function usePartyBalances(partyId: DocumentId): BalancesByParticipant {
  const [party] = useSuspenseDocument<Party>(partyId, { required: true });

  // Get all balance document IDs from the party's chunk refs
  const balanceIds = party.chunkRefs.map((ref) => ref.balancesId);

  // Load all balance documents
  const balanceDocs = useMultipleSuspenseDocuments<PartyExpenseChunkBalances>(
    balanceIds,
  );

  // Merge balances from all chunks
  const allBalances = balanceDocs
    .map((item) => item.doc?.balances)
    .filter((b): b is BalancesByParticipant => b !== undefined);

  const merged = mergeBalancesByParticipant(...allBalances);

  // Ensure all participants have entries
  for (const [participantId] of Object.entries(party.participants)) {
    if (!merged[participantId]) {
      merged[participantId] = {
        participantId,
        stats: {
          userOwes: 0,
          owedToUser: 0,
          diffs: {},
          balance: 0,
        },
        visualRatio: 0,
      };
    }
  }

  return merged;
}
