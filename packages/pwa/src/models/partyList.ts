/**
 * Re-export PartyList model types from @trizum/sdk.
 */
import type { DocumentId, Repo } from "@trizum/sdk";
import { isValidDocumentId } from "@trizum/sdk";

export type { PartyList, UpdatePartyListInput } from "@trizum/sdk";
export { PARTY_LIST_STORAGE_KEY } from "@trizum/sdk";

// Import for local use
import type { PartyList } from "@trizum/sdk";

/**
 * Get or create the PartyList document for this user.
 * Uses localStorage to persist the document ID across sessions.
 *
 * @param repo - The Automerge repository
 * @returns The PartyList document ID
 */
export function getPartyListId(repo: Repo) {
  const id = localStorage.getItem("partyListId");

  if (id && isValidDocumentId(id)) {
    return id;
  }

  // Can't explicity set `locale: undefined` because of automerge...
  const handle = repo.create<PartyList>({
    id: "" as DocumentId,
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    participantInParties: {},
  });

  handle.change((doc) => (doc.id = handle.documentId as unknown as DocumentId));

  localStorage.setItem("partyListId", handle.documentId);
  return handle.documentId as unknown as DocumentId;
}
