import { useProfileId } from "#src/hooks/useProfileId.ts";
import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity, ProfileEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView, useViews } from "react-fate";
import { view } from "@nkzw/fate";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";

const ProfileHomeView = view<ProfileEntity>()({
  id: true,
  available: true,
  parties: true,
  pinnedParties: true,
  archivedParties: true,
  lastUsedAt: true,
  lastOpenedPartyId: true,
  participantInParties: true,
});

const PartyTransferView = view<PartyEntity>()({
  id: true,
  available: true,
  symbol: true,
  description: true,
  name: true,
  currency: true,
  participants: true,
});

export interface EligibleDebtTransferParty {
  party: Pick<Party, "id" | "name" | "symbol" | "description" | "currency" | "participants">;
  currentParticipantId: PartyParticipant["id"];
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
}

interface EligibleDebtTransferParticipants {
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
}

export function getEligibleDebtTransferParticipants(
  party: Pick<Party, "participants">,
  currentParticipantId: PartyParticipant["id"],
): EligibleDebtTransferParticipants | null {
  const currentParticipant = party.participants[currentParticipantId];

  if (!currentParticipant || currentParticipant.isArchived) {
    return null;
  }

  const otherParticipants = Object.values(party.participants)
    .filter((participant) => !participant.isArchived && participant.id !== currentParticipant.id)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (otherParticipants.length === 0) {
    return null;
  }

  return {
    currentParticipant,
    otherParticipants,
  };
}

export function useEligibleDebtTransferParties(): EligibleDebtTransferParty[] {
  const client = useFateClient();
  const partyId = useCurrentPartyId();
  const profileId = useProfileId();

  const originParty = requireAvailable(
    useView(PartyTransferView, client.ref<PartyEntity>("Party", partyId, PartyTransferView)),
  );

  const partyList = requireAvailable(
    useView(ProfileHomeView, client.ref<ProfileEntity>("Profile", profileId, ProfileHomeView)),
  );

  const { activePartyIds } = getOrderedPartySections(partyList);

  const joinedActiveParties = activePartyIds.flatMap((partyId) => {
    const currentParticipantId = partyList.participantInParties[partyId];

    if (partyId === originParty.id || currentParticipantId === undefined) {
      return [];
    }

    return [
      {
        partyId,
        currentParticipantId,
      },
    ];
  });

  const partyEntries = useViews(
    PartyTransferView,
    joinedActiveParties.map(({ partyId }) =>
      client.ref<PartyEntity>("Party", partyId, PartyTransferView),
    ),
  );

  return partyEntries.flatMap((doc, index) => {
    if (!doc.available || doc.currency !== originParty.currency) {
      return [];
    }

    const joinedActiveParty = joinedActiveParties[index];

    if (!joinedActiveParty) {
      return [];
    }

    const currentParticipantId = joinedActiveParty.currentParticipantId;
    const eligibleParticipants = getEligibleDebtTransferParticipants(doc, currentParticipantId);

    if (!eligibleParticipants) {
      return [];
    }

    return [
      {
        party: doc,
        currentParticipantId,
        currentParticipant: eligibleParticipants.currentParticipant,
        otherParticipants: eligibleParticipants.otherParticipants,
      },
    ];
  });
}
