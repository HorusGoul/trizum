import type { PartyParticipant } from "#src/models/party.js";

export interface PartySettingsFormValues {
  name: string;
  symbol: string;
  description: string;
  participants: (PartyParticipant | (PartyParticipant & { __isNew: true }))[];
}

export interface AddPartyParticipantFormValues {
  newParticipantName: string;
}
