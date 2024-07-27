import type { DocumentId } from "@automerge/automerge-repo/slim";

export interface PartyList {
  username: string;
  phone: string;
  parties: Record<DocumentId, true | undefined>;
}
