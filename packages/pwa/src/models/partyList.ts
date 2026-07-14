import { isValidDocumentId, type Repo, type DocumentId } from "@automerge/automerge-repo/slim";
import type { SupportedLocale } from "#src/lib/locales.js";
import type { Party, PartyParticipant } from "./party";

const PARTY_LIST_ID_STORAGE_KEY = "partyListId";
const PARTY_LIST_ID_CHANGED_EVENT = "trizum:party-list-id-changed";

export interface PartyList {
  id: DocumentId;
  type: "partyList";
  username: string;
  phone: string;
  avatarId?: DocumentId | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
  autoOpenCalculator?: boolean;
  hue?: number;
  lastOpenedPartyId?: DocumentId | null;
  parties: Record<Party["id"], true | undefined>;
  pinnedParties?: Record<Party["id"], true | undefined>;
  archivedParties?: Record<Party["id"], true | undefined>;
  lastUsedAt?: Record<Party["id"], number | undefined>;
  participantInParties: Record<Party["id"], PartyParticipant["id"]>;
}

function createPartyListHandle(repo: Repo) {
  // Can't explicity set `locale: undefined` because of automerge...
  const handle = repo.create<PartyList>({
    id: "" as DocumentId,
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    pinnedParties: {},
    archivedParties: {},
    lastUsedAt: {},
    participantInParties: {},
  });

  handle.change((doc) => (doc.id = handle.documentId));

  localStorage.setItem(PARTY_LIST_ID_STORAGE_KEY, handle.documentId);
  return handle;
}

export async function getPartyListHandle(repo: Repo) {
  const id = localStorage.getItem(PARTY_LIST_ID_STORAGE_KEY);

  if (id && isValidDocumentId(id)) {
    try {
      return await repo.find<PartyList>(id);
    } catch {
      // Fall back to a fresh party list if the existing handle cannot be
      // recovered from local storage.
    }
  }

  return createPartyListHandle(repo);
}

export function getPartyListId(repo: Repo) {
  const id = localStorage.getItem(PARTY_LIST_ID_STORAGE_KEY);

  if (id && isValidDocumentId(id)) {
    return id;
  }

  return createPartyListHandle(repo).documentId;
}

export function setPartyListId(id: DocumentId) {
  localStorage.setItem(PARTY_LIST_ID_STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent<DocumentId>(PARTY_LIST_ID_CHANGED_EVENT, { detail: id }));
}

export function subscribeToPartyListId(onPartyListIdChanged: (partyListId: DocumentId) => void) {
  function handlePartyListIdChanged(event: Event) {
    onPartyListIdChanged((event as CustomEvent<DocumentId>).detail);
  }

  function handleStorage(event: StorageEvent) {
    if (
      event.key === PARTY_LIST_ID_STORAGE_KEY &&
      event.newValue &&
      isValidDocumentId(event.newValue)
    ) {
      onPartyListIdChanged(event.newValue);
    }
  }

  window.addEventListener(PARTY_LIST_ID_CHANGED_EVENT, handlePartyListIdChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PARTY_LIST_ID_CHANGED_EVENT, handlePartyListIdChanged);
    window.removeEventListener("storage", handleStorage);
  };
}
