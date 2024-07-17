import type { DocumentId } from "@automerge/automerge-repo/slim";

export interface PartyList {
  parties: Record<DocumentId, true | undefined>;
}
