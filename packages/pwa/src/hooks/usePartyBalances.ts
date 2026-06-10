import { calculateBalancesByParticipant, type BalancesByParticipant } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";
import { fateAllPartyExpensesCache, useFateCache } from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { useParty } from "./useParty";

export function usePartyBalances(partyId: Party["id"]): BalancesByParticipant {
  const { client } = useTrizumData();
  const { party } = useParty(partyId);
  const expenses = useFateCache(fateAllPartyExpensesCache, client, partyId);

  if (!party) {
    return {};
  }

  return calculateBalancesByParticipant(expenses, party.participants);
}
