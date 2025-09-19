import type { Party, PartyExpenseChunkBalances } from "#src/models/party.ts";
import {
  useMultipleSuspenseDocument,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.ts";
import {
  calculateBalancesByParticipant,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
} from "#src/models/expense.ts";

export function usePartyBalances(partyId: Party["id"]): BalancesByParticipant {
  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  const results = useMultipleSuspenseDocument<PartyExpenseChunkBalances>(
    party.chunkRefs.map((chunkRef) => chunkRef.balancesId),
    {
      required: true,
    },
  );

  // Needed for the assumption that there's always at least a balance for each participant
  // But chunks can be created without expenses, or might have an old balance that doesn't include
  // all participants that exist when running this hook
  const baseBalance = calculateBalancesByParticipant([], party.participants);

  return mergeBalancesByParticipant(
    baseBalance,
    ...results.map(({ doc }) => doc.balances),
  );
}
