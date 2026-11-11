import { useAppData } from "#src/lib/data/useAppData.ts";
import { PartyBalancesView, BalanceView } from "#src/lib/data/views.ts";
import type { BalanceEntity } from "#src/lib/data/entities.ts";
import { useParty } from "./useParty.ts";
import type { Party } from "#src/models/party.ts";
import { useRequiredViews } from "#src/lib/data/hooks.ts";
import {
  calculateBalancesByParticipant,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
} from "#src/models/expense.ts";

export function usePartyBalances(partyId: Party["id"]): BalancesByParticipant {
  const data = useAppData();
  const { party } = useParty(partyId, PartyBalancesView);

  const results = useRequiredViews(
    BalanceView,
    party.chunkRefs.map(({ balancesId }) =>
      data.entityRef<BalanceEntity>("Balance", balancesId, BalanceView),
    ),
  );

  // Needed for the assumption that there's always at least a balance for each participant
  // But chunks can be created without expenses, or might have an old balance that doesn't include
  // all participants that exist when running this hook
  const baseBalance = calculateBalancesByParticipant([], party.participants);

  return mergeBalancesByParticipant(baseBalance, ...results.map((balance) => balance.balances));
}
