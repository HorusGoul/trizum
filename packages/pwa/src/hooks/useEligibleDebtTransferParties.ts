import {
  ParticipantView,
  PartySettingsView,
  type ParticipantEntity,
  type PartyEntity,
} from "@trizum/data";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";
import { toParty } from "#src/lib/data/fateAppData.ts";
import { useFateLiveListView, useFateLiveViews, useFateRequest } from "#src/lib/data/fateReact.ts";
import { PARTICIPANT_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
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
  const destinationPartyIds = joinedActiveParties.map(({ partyId }) => partyId);
  const { participants, parties: partyRefs } = useFateRequest({
    participants: {
      list: PARTICIPANT_CONNECTION_VIEW,
    },
    parties: {
      ids: destinationPartyIds,
      view: PartySettingsView,
    },
  });
  const partyEntities = useFateLiveViews(PartySettingsView, partyRefs);
  const participantRefs = useFateLiveListView<ParticipantEntity>(
    PARTICIPANT_CONNECTION_VIEW,
    participants,
  ).items.map(({ node }) => node);
  const participantEntities = useFateLiveViews(ParticipantView, participantRefs);
  const participantsByPartyId = groupParticipantsByPartyId(participantEntities);
  const partiesById = new Map<Party["id"], Party>(
    partyEntities.map((partyEntity: PartyEntity) => [
      partyEntity.id,
      toParty(partyEntity, participantsByPartyId.get(partyEntity.id) ?? []),
    ]),
  );

  return joinedActiveParties.flatMap((joinedActiveParty) => {
    const party = partiesById.get(joinedActiveParty.partyId);

    if (!party || !originParty || party.currency !== originParty.currency) {
      return [];
    }

    const currentParticipantId = joinedActiveParty.currentParticipantId;
    const eligibleParticipants = getEligibleDebtTransferParticipants(party, currentParticipantId);

    if (!eligibleParticipants) {
      return [];
    }

    return [
      {
        party,
        currentParticipantId,
        currentParticipant: eligibleParticipants.currentParticipant,
        otherParticipants: eligibleParticipants.otherParticipants,
      },
    ];
  });
}

function groupParticipantsByPartyId(participants: readonly ParticipantEntity[]) {
  const groups = new Map<Party["id"], ParticipantEntity[]>();

  for (const participant of participants) {
    const partyParticipants = groups.get(participant.partyId) ?? [];
    partyParticipants.push(participant);
    groups.set(participant.partyId, partyParticipants);
  }

  return groups;
}
