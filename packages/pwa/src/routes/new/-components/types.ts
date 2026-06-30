import type { CurrencyCode } from "#src/lib/money.ts";
import type { PartyParticipant } from "#src/models/party.js";

export interface CurrencyOption {
  id: CurrencyCode;
  name: string;
  symbol: string;
}

export interface NewPartyFormValues {
  name: string;
  symbol: string;
  description: string;
  currency: CurrencyCode;
  participants: Pick<PartyParticipant, "id" | "name">[];
}

export interface AddParticipantFormValues {
  newParticipantName: string;
}
