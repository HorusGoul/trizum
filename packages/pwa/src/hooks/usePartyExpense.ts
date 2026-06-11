import { useEffect } from "react";
import { ExpenseListItemView, toEntityId, type ExpenseEntity, type ViewRef } from "@trizum/data";
import { toExpense } from "#src/lib/data/fateAppData.ts";
import {
  useFateCachedView,
  useFateLiveListView,
  useFateLiveViews,
  useFateRequest,
} from "#src/lib/data/fateReact.ts";
import { EXPENSE_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import type { Expense } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";

export function usePartyExpense(partyId: Party["id"], expenseId: Expense["id"]) {
  const { client } = useTrizumData();
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
  const listExpenseEntity = expenseEntities.find((expense) => expense.id === expenseId);
  const cachedExpenseRef = client.rootListRef(
    toEntityId("Expense", expenseId),
    ExpenseListItemView,
  ) as ViewRef<"Expense">;
  const cachedExpenseEntity = useFateCachedView(ExpenseListItemView, cachedExpenseRef);
  const expenseEntity = listExpenseEntity ?? cachedExpenseEntity;

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
