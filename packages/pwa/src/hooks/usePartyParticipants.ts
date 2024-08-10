import { useCurrentParty } from "./useParty";

export function usePartyParticipants() {
  const { party } = useCurrentParty();

  const all = Object.values(party.participants);
  const archived = all.filter((participant) => participant.isArchived);
  const active = all.filter((participant) => !participant.isArchived);

  return { all, archived, active };
}
