import { view } from "@nkzw/fate";
import { useFateClient, useView } from "react-fate";
import type { ExpenseEntity, ExpenseHistoryEntity } from "#src/lib/data/entities.ts";
import { useRequiredViews } from "#src/lib/data/hooks.ts";
import { mutationResult } from "#src/lib/data/mutationResult.ts";
import type { Party } from "#src/models/party.ts";

const HistoryView = view<ExpenseHistoryEntity>()({
  expenseIds: true,
  hasNext: true,
  isLoadingNext: true,
});

const ExpenseDetailView = view<ExpenseEntity>()({
  id: true,
  available: true,
  name: true,
  paidAt: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
  __hash: true,
});

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const client = useFateClient();

  const page = useView(
    HistoryView,
    client.ref<ExpenseHistoryEntity>("ExpenseHistory", partyId, HistoryView),
  );

  const expenses = useRequiredViews(
    ExpenseDetailView,
    page.expenseIds.map((id) => client.ref<ExpenseEntity>("Expense", id, ExpenseDetailView)),
  );

  function loadNext() {
    void mutationResult(client.mutations.expenseHistory.loadNext({ input: { partyId } }));
  }

  return { expenses, loadNext, isLoadingNext: page.isLoadingNext, hasNext: page.hasNext };
}
