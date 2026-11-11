import { view } from "@nkzw/fate";
import type { BalanceEntity, PartyEntity } from "#src/lib/data/entities.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import { useParty } from "./useParty.ts";
import type { Party } from "#src/models/party.ts";
import { useRequiredViews } from "#src/lib/data/hooks.ts";
import {
  calculateBalancesByParticipant,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
} from "#src/models/expense.ts";

const PartyBalancesView = view<PartyEntity>()({
  id: true,
  available: true,
  currency: true,
  participants: true,
  chunkRefs: true,
});

const BalanceView = view<BalanceEntity>()({
  id: true,
  available: true,
  balances: true,
});

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
