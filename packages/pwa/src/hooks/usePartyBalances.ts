import type { Party } from "#src/models/party.ts";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import {
  calculateBalancesByParticipant,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
} from "#src/models/expense.ts";

export function usePartyBalances(partyId: Party["id"]): BalancesByParticipant {
  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  // Needed for the assumption that there's always at least a balance for each participant
  // But chunks can be created without expenses, or might have an old balance that doesn't include
  // all participants that exist when running this hook
  const baseBalance = calculateBalancesByParticipant([], party.participants);

  return mergeBalancesByParticipant(
    baseBalance,
    ...party.chunkRefs.map((chunkRef) => chunkRef.balancesByParticipant),
  );
}
