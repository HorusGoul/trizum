import { useFateClient } from "react-fate";
import { useRequiredView } from "#src/lib/data/hooks.ts";
import { useParams } from "@tanstack/react-router";
import type { View, Selection } from "@nkzw/fate";
import type { PartyEntity } from "#src/lib/data/entities.ts";

export function useParty<const Selected extends Selection<PartyEntity>>(
  partyId: string,
  selected: View<PartyEntity, Selected>,
) {
  const client = useFateClient();
  const party = useRequiredView(selected, client.ref<PartyEntity>("Party", partyId, selected));

  return { party, partyId };
}

export function useCurrentPartyId() {
  const partyId = useParams({ strict: false, select: (params) => params.partyId });

  if (!partyId) throw new Error("No Party ID found in URL");

  return partyId;
}

export function useCurrentParty<const Selected extends Selection<PartyEntity>>(
  selected: View<PartyEntity, Selected>,
) {
  return useParty(useCurrentPartyId(), selected);
}
