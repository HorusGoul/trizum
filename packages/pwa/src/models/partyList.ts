/**
 * Re-export PartyList model types from @trizum/sdk.
 */
import type { ITrizumClient, PartyList } from "@trizum/sdk";
import { isValidDocumentId } from "@trizum/sdk";

export type { PartyList, UpdatePartyListInput } from "@trizum/sdk";
export { PARTY_LIST_STORAGE_KEY } from "@trizum/sdk";

/**
 * Get or create the PartyList document for this user.
 * Uses localStorage to persist the document ID across sessions.
 *
 * @param client - The Trizum client
 * @returns The PartyList document ID
 */
export function getPartyListId(client: ITrizumClient) {
  const id = localStorage.getItem("partyListId");

  if (id && isValidDocumentId(id)) {
    return id;
  }

  // Can't explicitly set `locale: undefined` because CRDTs don't support undefined values
  const { id: newId } = client.create<PartyList>({
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    participantInParties: {},
  });

  localStorage.setItem("partyListId", newId);
  return newId;
}
