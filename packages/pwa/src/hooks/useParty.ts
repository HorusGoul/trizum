import { useRequiredView } from "#src/lib/data/hooks.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import { useParams } from "@tanstack/react-router";
import type { View, Selection } from "@nkzw/fate";
import type { PartyEntity } from "#src/lib/data/entities.ts";

export function useParty<const Selected extends Selection<PartyEntity>>(
  partyId: string,
  selected: View<PartyEntity, Selected>,
) {
  const data = useAppData();
  const party = useRequiredView(selected, data.entityRef<PartyEntity>("Party", partyId, selected));

  async function createTestExpenses() {
    const answer = window.prompt("How many test expenses to create?");

    if (!answer) return;

    await data.createTestExpenses(partyId, parseInt(answer));
  }

  return {
    party,
    partyId,
    isLoading: false,
    ...data.readyPartyActions(partyId),
    dev: { createTestExpenses },
  };
}

export function useCurrentParty<const Selected extends Selection<PartyEntity>>(
  selected: View<PartyEntity, Selected>,
) {
  const partyId = useParams({ strict: false, select: (params) => params.partyId });

  if (!partyId) throw new Error("No Party ID found in URL");

  return useParty(partyId, selected);
}
