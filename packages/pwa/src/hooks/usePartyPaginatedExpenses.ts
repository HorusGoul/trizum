import { useEffect } from "react";
import { ExpenseListItemView, type ExpenseEntity } from "@trizum/data";
import { toExpense, writeExpenseEntityToFateCache } from "#src/lib/data/fateAppData.ts";
import { useFateLiveListView, useFateLiveViews, useFateRequest } from "#src/lib/data/fateReact.ts";
import { EXPENSE_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import type { Party } from "#src/models/party.js";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const { client, hasRemoteSync, settledClient } = useTrizumData();
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

  useEffect(() => {
    if (!hasRemoteSync) {
      return;
    }

    let isCurrent = true;

    async function refreshSettledExpenses() {
      const { expenses: settledExpenses } = await settledClient.request(
        {
          expenses: {
            args: { partyId },
            list: EXPENSE_CONNECTION_VIEW,
          },
        },
        { mode: "network-only" },
      );

      for (const { node } of settledExpenses.items) {
        if (!isCurrent) {
          return;
        }

        const snapshot = await settledClient.readView(ExpenseListItemView, node);

        if (!isCurrent) {
          return;
        }

        writeExpenseEntityToFateCache(client, snapshot.data as unknown as ExpenseEntity);
      }
    }

    void refreshSettledExpenses().catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [client, hasRemoteSync, partyId, settledClient]);

  return {
    expenses: expenseEntities.map(toExpense),
    loadNext: liveExpenses.loadNext,
    isLoadingNext: liveExpenses.isLoadingNext,
    hasNext: liveExpenses.hasNext,
  };
}
