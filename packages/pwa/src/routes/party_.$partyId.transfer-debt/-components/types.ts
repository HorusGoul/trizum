import type { EligibleDebtTransferParty } from "#src/hooks/useEligibleDebtTransferParties.ts";
import type { PartyParticipant } from "#src/models/party.ts";

export interface DestinationPartyOption {
  id: string;
  entry: EligibleDebtTransferParty;
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
  exactMatchParticipant: PartyParticipant | null;
  recommendedParticipants: PartyParticipant[];
}
