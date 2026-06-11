import { useEffect } from "react";
import { ExpenseListItemView, toEntityId, type ExpenseEntity, type ViewRef } from "@trizum/data";
import {
  toExpense,
  waitForExpenseEntityInFate,
  writeExpenseEntityToFateCache,
} from "#src/lib/data/fateAppData.ts";
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
import { useState } from "react";

type MissingExpenseState =
  | { key: string; status: "found"; value: ExpenseEntity }
  | { key: string; status: "notFound" }
  | { key: string; status: "pending" }
  | { error: unknown; key: string; status: "error" };

export function usePartyExpense(partyId: Party["id"], expenseId: Expense["id"]) {
  const { client, hasRemoteSync, settledClient } = useTrizumData();
  const missingKey = `${partyId}:${expenseId}`;
  const [missingExpenseState, setMissingExpenseState] = useState<MissingExpenseState>({
    key: missingKey,
    status: "pending",
  });
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
  const missingExpense =
    missingExpenseState.key === missingKey
      ? missingExpenseState
      : ({ key: missingKey, status: "pending" } satisfies MissingExpenseState);
  const primedExpenseEntity = missingExpense.status === "found" ? missingExpense.value : undefined;
  const expenseEntity = listExpenseEntity ?? cachedExpenseEntity ?? primedExpenseEntity;

  useEffect(() => {
    if (!expenseEntity && liveExpenses.hasNext && !liveExpenses.isLoadingNext) {
      liveExpenses.loadNext();
    }
  }, [expenseEntity, liveExpenses]);

  useEffect(() => {
    if (expenseEntity) {
      return;
    }

    let isCurrent = true;

    setMissingExpenseState((current) =>
      current.key === missingKey && current.status === "pending"
        ? current
        : { key: missingKey, status: "pending" },
    );

    async function primeMissingExpense() {
      const localExpense = await waitForExpenseEntityInFate(client, expenseId, {
        timeoutMs: hasRemoteSync ? 1_500 : 8_000,
      });

      if (localExpense) {
        return localExpense;
      }

      if (!hasRemoteSync) {
        return undefined;
      }

      const settledExpense = await waitForExpenseEntityInFate(settledClient, expenseId, {
        timeoutMs: 30_000,
      });

      if (settledExpense) {
        writeExpenseEntityToFateCache(client, settledExpense);
      }

      return settledExpense;
    }

    void primeMissingExpense().then(
      (expense) => {
        if (!isCurrent) {
          return;
        }

        setMissingExpenseState(
          expense
            ? { key: missingKey, status: "found", value: expense }
            : { key: missingKey, status: "notFound" },
        );
      },
      (error: unknown) => {
        if (isCurrent) {
          setMissingExpenseState({ error, key: missingKey, status: "error" });
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [client, expenseEntity, expenseId, hasRemoteSync, missingKey, settledClient]);

  if (!expenseEntity && missingExpense.status === "error") {
    throw missingExpense.error;
  }

  return {
    expense: expenseEntity ? toExpense(expenseEntity) : null,
    isLoading:
      !expenseEntity &&
      (liveExpenses.hasNext || liveExpenses.isLoadingNext || missingExpense.status !== "notFound"),
  };
}
