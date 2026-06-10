import { calculateBalancesByParticipant, type BalancesByParticipant } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";
import { toExpense } from "#src/lib/data/fateAppData.ts";
import { useFateLiveListView, useFateLiveViews, useFateRequest } from "#src/lib/data/fateReact.ts";
import { ALL_EXPENSES_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import { useParty } from "./useParty";
import { ExpenseListItemView, type ExpenseEntity } from "@trizum/data";

export function usePartyBalances(partyId: Party["id"]): BalancesByParticipant {
  const { party } = useParty(partyId);
  const { expenses } = useFateRequest({
    expenses: {
      args: { partyId },
      list: ALL_EXPENSES_CONNECTION_VIEW,
    },
  });
  const liveExpenses = useFateLiveListView<ExpenseEntity>(ALL_EXPENSES_CONNECTION_VIEW, expenses);
  const expenseEntities = useFateLiveViews(
    ExpenseListItemView,
    liveExpenses.items.map(({ node }) => node),
  );

  if (!party) {
    return {};
  }

  return calculateBalancesByParticipant(expenseEntities.map(toExpense), party.participants);
}
