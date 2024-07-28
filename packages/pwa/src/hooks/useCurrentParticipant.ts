import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";

export function useCurrentParticipant() {
  const { party } = useCurrentParty();
  const { partyList } = usePartyList();

  const participantId = partyList.participantInParties?.[party.id];
  const participant = party.participants[participantId];

  if (!participant) {
    throw new Error("Participant not found");
  }

  return participant;
}
