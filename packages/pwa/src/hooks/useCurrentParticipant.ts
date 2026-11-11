import { ProfileMembershipView } from "#src/lib/data/views.ts";
import { PartyParticipantsView } from "#src/lib/data/views.ts";
import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";

export function useCurrentParticipant() {
  const { party } = useCurrentParty(PartyParticipantsView);
  const { partyList } = usePartyList(ProfileMembershipView);

  const participantId = partyList.participantInParties?.[party.id];
  const participant = party.participants[participantId];

  if (!participant) {
    throw new Error("Participant not found");
  }

  return participant;
}
