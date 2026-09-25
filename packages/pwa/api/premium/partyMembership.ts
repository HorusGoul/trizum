import { isValidDocumentId, type DocumentId } from "@automerge/automerge-repo";
import type { AutomergeDocuments } from "../automergeDocuments";
import type { Party } from "../../src/models/party.js";

interface PartyListMembershipDocument {
  participantInParties?: Record<string, string | undefined>;
  parties?: Record<string, true | undefined>;
  type: "partyList";
}

export class PartyMembershipUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PartyMembershipUnavailableError";
  }
}

export async function verifyPartyMembership({
  documents,
  partyDocumentId,
  partyListDocumentId,
}: {
  documents: AutomergeDocuments;
  partyDocumentId: string;
  partyListDocumentId: string;
}) {
  if (!isValidDocumentId(partyDocumentId) || !isValidDocumentId(partyListDocumentId)) {
    return false;
  }

  const partyId = partyDocumentId as DocumentId;
  const partyListId = partyListDocumentId as DocumentId;
  try {
    const partyList = await documents.read<PartyListMembershipDocument>(partyListId);
    const participantId = partyList?.participantInParties?.[partyId];

    if (!partyList || partyList.type !== "partyList" || partyList.parties?.[partyId] !== true) {
      return false;
    }

    if (!participantId) {
      return false;
    }

    const party = await documents.read<Party>(partyId);

    return isPartyMembershipValid({
      participantId,
      party,
      partyDocumentId,
    });
  } catch (error) {
    throw new PartyMembershipUnavailableError("Party membership could not be verified.", {
      cause: error,
    });
  }
}

export function isPartyMembershipValid({
  participantId,
  party,
  partyDocumentId,
}: {
  participantId: string;
  party: Party | undefined;
  partyDocumentId: string;
}) {
  if (!party || party.type !== "party" || party.id !== partyDocumentId) {
    return false;
  }

  const participant = party.participants?.[participantId];
  return Boolean(participant && participant.id === participantId && !participant.isArchived);
}
