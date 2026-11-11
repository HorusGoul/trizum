import { PartyParticipantsView } from "#src/lib/data/views.ts";
import { useCurrentParty } from "./useParty";

export function usePartyParticipants() {
  const { party } = useCurrentParty(PartyParticipantsView);

  const all = Object.values(party.participants);
  const archived = all.filter((participant) => participant.isArchived);
  const active = all.filter((participant) => !participant.isArchived);

  return { all, archived, active };
}
