import { view } from "@nkzw/fate";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { useCurrentParty } from "./useParty";

const PartyParticipantsView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
});

export function usePartyParticipants() {
  const { party } = useCurrentParty(PartyParticipantsView);

  const all = Object.values(party.participants);
  const archived = all.filter((participant) => participant.isArchived);
  const active = all.filter((participant) => !participant.isArchived);

  return { all, archived, active };
}
