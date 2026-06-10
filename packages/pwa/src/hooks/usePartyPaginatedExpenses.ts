import { ExpenseListItemView, type ExpenseEntity } from "@trizum/data";
import { toExpense } from "#src/lib/data/fateAppData.ts";
import { useFateLiveListView, useFateLiveViews, useFateRequest } from "#src/lib/data/fateReact.ts";
import { EXPENSE_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import type { Party } from "#src/models/party.js";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const { expenses } = useFateRequest({
    expenses: {
      args: { partyId },
      list: EXPENSE_CONNECTION_VIEW,
    },
  });
  const liveExpenses = useFateLiveListView<ExpenseEntity>(EXPENSE_CONNECTION_VIEW, expenses);
  const expenseEntities = useFateLiveViews(
    ExpenseListItemView,
    liveExpenses.items.map(({ node }) => node),
  );

  return {
    expenses: expenseEntities.map(toExpense),
    loadNext: liveExpenses.loadNext,
    isLoadingNext: liveExpenses.isLoadingNext,
    hasNext: liveExpenses.hasNext,
  };
}
