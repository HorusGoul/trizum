import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";
import type { PartyParticipant } from "#src/models/party.js";

export function useCurrentParticipant() {
  const { party } = useCurrentParty();
  const { partyList } = usePartyList();

  const participantId = partyList.participantInParties?.[party.id];
  const participant = party.participants[participantId];

  if (participant) {
    return participant;
  }

  if (participantId) {
    return createPendingParticipant(participantId);
  }

  const fallbackParticipant = Object.values(party.participants).find(
    (partyParticipant) => !partyParticipant.isArchived,
  );

  if (fallbackParticipant) {
    return fallbackParticipant;
  }

  throw new Error("Participant not found");
}

function createPendingParticipant(participantId: PartyParticipant["id"]): PartyParticipant {
  return {
    balancesSortedBy: "name",
    id: participantId,
    isArchived: false,
    name: "",
    personalMode: false,
  };
}
