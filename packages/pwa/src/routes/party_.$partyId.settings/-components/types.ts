import type { PartyParticipant } from "#src/models/party.js";

export interface PartyDetailsFormValues {
  name: string;
  symbol: string;
  description: string;
}

export interface PartyParticipantsFormValues {
  participants: (PartyParticipant | (PartyParticipant & { __isNew: true }))[];
}

export interface AddPartyParticipantFormValues {
  newParticipantName: string;
}
