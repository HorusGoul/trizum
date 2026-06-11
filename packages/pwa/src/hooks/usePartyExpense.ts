import { useEffect } from "react";
import { ExpenseListItemView, type ExpenseEntity } from "@trizum/data";
import { toExpense } from "#src/lib/data/fateAppData.ts";
import { useFateLiveListView, useFateLiveViews, useFateRequest } from "#src/lib/data/fateReact.ts";
import { EXPENSE_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import type { Expense } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";

export function usePartyExpense(partyId: Party["id"], expenseId: Expense["id"]) {
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
  const expenseEntity = expenseEntities.find((expense) => expense.id === expenseId);

  useEffect(() => {
    if (!expenseEntity && liveExpenses.hasNext && !liveExpenses.isLoadingNext) {
      liveExpenses.loadNext();
    }
  }, [expenseEntity, liveExpenses]);

  return {
    expense: expenseEntity ? toExpense(expenseEntity) : null,
    isLoading: !expenseEntity && (liveExpenses.hasNext || liveExpenses.isLoadingNext),
  };
}
