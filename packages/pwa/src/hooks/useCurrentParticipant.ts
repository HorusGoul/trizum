import { view } from "@nkzw/fate";
import type { ProfileEntity, PartyEntity } from "#src/lib/data/entities.ts";
import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";

const ProfileMembershipView = view<ProfileEntity>()({
  id: true,
  available: true,
  participantInParties: true,
});

const PartyParticipantsView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
});

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
