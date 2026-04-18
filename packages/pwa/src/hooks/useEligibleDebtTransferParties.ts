import type { Party, PartyParticipant } from "#src/models/party.ts";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { useCurrentParty } from "./useParty";
import { usePartyList } from "./usePartyList";

export interface EligibleDebtTransferParty {
  party: Party;
  currentParticipantId: PartyParticipant["id"];
}

export function useEligibleDebtTransferParties(): EligibleDebtTransferParty[] {
  const { party: originParty } = useCurrentParty();
  const { partyList } = usePartyList();
  const { activePartyIds } = getOrderedPartySections(partyList);

  const joinedActivePartyIds = activePartyIds.filter((partyId) => {
    return (
      partyId !== originParty.id &&
      partyList.participantInParties[partyId] !== undefined
    );
  });

  const partyEntries = useMultipleSuspenseDocument<Party>(joinedActivePartyIds);

  return partyEntries
    .map(({ doc }) => doc)
    .filter((party): party is Party => {
      return !!party && party.currency === originParty.currency;
    })
    .map((party) => ({
      party,
      currentParticipantId: partyList.participantInParties[party.id],
    }));
}
