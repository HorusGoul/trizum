import { useProfileId } from "#src/hooks/useProfileId.ts";
import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity, ProfileEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";

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
  const client = useFateClient();
  const partyId = useCurrentPartyId();
  const profileId = useProfileId();

  const party = requireAvailable(
    useView(
      PartyParticipantsView,
      client.ref<PartyEntity>("Party", partyId, PartyParticipantsView),
    ),
  );

  const partyList = requireAvailable(
    useView(
      ProfileMembershipView,
      client.ref<ProfileEntity>("Profile", profileId, ProfileMembershipView),
    ),
  );

  const participantId = partyList.participantInParties?.[party.id];
  const participant = party.participants[participantId];

  if (!participant) {
    throw new Error("Participant not found");
  }

  return participant;
}
