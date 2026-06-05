import type { Party, PartyParticipant } from "#src/models/party.ts";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";

export interface EligibleDebtTransferParty {
  party: Party;
  currentParticipantId: PartyParticipant["id"];
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
}

interface EligibleDebtTransferParticipants {
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
}

export function getEligibleDebtTransferParticipants(
  party: Party,
  currentParticipantId: PartyParticipant["id"],
): EligibleDebtTransferParticipants | null {
  const currentParticipant = party.participants[currentParticipantId];

  if (!currentParticipant || currentParticipant.isArchived) {
    return null;
  }

  const otherParticipants = Object.values(party.participants)
    .filter(
      (participant) =>
        !participant.isArchived && participant.id !== currentParticipant.id,
    )
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
  const { party: originParty } = useCurrentParty();
  const { partyList } = usePartyList();
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

  const partyEntries = useMultipleSuspenseDocument<Party>(
    joinedActiveParties.map(({ partyId }) => partyId),
  );

  return partyEntries.flatMap(({ doc }, index) => {
    if (!doc || doc.currency !== originParty.currency) {
      return [];
    }

    const joinedActiveParty = joinedActiveParties[index];

    if (!joinedActiveParty) {
      return [];
    }

    const currentParticipantId = joinedActiveParty.currentParticipantId;
    const eligibleParticipants = getEligibleDebtTransferParticipants(
      doc,
      currentParticipantId,
    );

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
