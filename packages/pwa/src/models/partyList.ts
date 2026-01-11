import {
  isValidDocumentId,
  type Repo,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import type { Party, PartyParticipant } from "./party";
import { getBrowserLocale, type SupportedLocale } from "#src/lib/i18n.js";

export interface PartyList {
  id: DocumentId;
  type: "partyList";
  username: string;
  phone: string;
  avatarId?: DocumentId | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
  lastOpenedPartyId?: DocumentId | null;
  parties: Record<Party["id"], true | undefined>;
  participantInParties: Record<Party["id"], PartyParticipant["id"]>;
}

export function getPartyListId(repo: Repo) {
  const id = localStorage.getItem("partyListId");

  if (id && isValidDocumentId(id)) {
    return id;
  }

  const handle = repo.create<PartyList>({
    id: "" as DocumentId,
    type: "partyList",
    username: "",
    phone: "",
    locale: getBrowserLocale(),
    parties: {},
    participantInParties: {},
  });

  handle.change((doc) => (doc.id = handle.documentId));

  localStorage.setItem("partyListId", handle.documentId);
  return handle.documentId;
}
