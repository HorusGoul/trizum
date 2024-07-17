import { createContext, useContext } from "react";
import type { PartyList } from "#src/models/partyList.js";
import type { ChangeOptions } from "@automerge/automerge/slim/next";
import { type ChangeFn, type Doc } from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.js";

export interface PartyListContextValue {
  partyList: Doc<PartyList> | undefined;
  changePartyList: (
    change: ChangeFn<PartyList>,
    options?: ChangeOptions<PartyList>,
  ) => void;
  addPartyToList: (partyId: Party["id"]) => void;
  removeParty: (partyId: Party["id"]) => void;
}

export const PartyListContext = createContext<PartyListContextValue>({
  partyList: undefined,
  changePartyList: () => {},
  addPartyToList: () => {},
  removeParty: () => {},
});

export function usePartyList() {
  return useContext(PartyListContext);
}
