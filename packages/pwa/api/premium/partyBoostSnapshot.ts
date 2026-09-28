import { isValidDocumentId } from "@automerge/automerge-repo";
import type { AutomergeDocuments } from "../automergeDocuments";
import type { Party, PartyBoostSnapshot } from "../../src/models/party";

export class PartyBoostSnapshotUnavailableError extends Error {
  override readonly name = "PartyBoostSnapshotUnavailableError";
}

/** Publishes server observations for local features; the server never trusts this cache. */
export async function publishPartyBoostSnapshot(
  documents: AutomergeDocuments,
  partyDocumentId: string,
  snapshot: PartyBoostSnapshot,
) {
  try {
    if (!isValidDocumentId(partyDocumentId)) throw new Error("Invalid party ID.");
    await documents.change<Party>(partyDocumentId, (party) => {
      if (party.type !== "party") throw new Error("Invalid party document.");
      party.boost = snapshot;
    });
  } catch (error) {
    throw new PartyBoostSnapshotUnavailableError("Could not sync Party Boost status.", {
      cause: error,
    });
  }
}
