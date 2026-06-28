import type { Currency } from "dinero.js";
import type { PartyParticipant } from "#src/models/party.js";

export interface CurrencyOption {
  id: Currency;
  name: string;
  symbol: string;
}

export interface NewPartyFormValues {
  name: string;
  symbol: string;
  description: string;
  currency: Currency;
  participants: Pick<PartyParticipant, "id" | "name">[];
}

export interface AddParticipantFormValues {
  newParticipantName: string;
}
