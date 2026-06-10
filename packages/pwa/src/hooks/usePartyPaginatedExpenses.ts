import {
  fatePartyExpensesCache,
  loadNextPartyExpenses,
  useFateCache,
} from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import type { Party } from "#src/models/party.js";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const { client } = useTrizumData();
  const snapshot = useFateCache(fatePartyExpensesCache, client, partyId);

  function loadNext() {
    void loadNextPartyExpenses(client, partyId);
  }

  return {
    expenses: snapshot.expenses,
    loadNext,
    isLoadingNext: snapshot.isLoadingNext,
    hasNext: snapshot.hasNext,
  };
}
