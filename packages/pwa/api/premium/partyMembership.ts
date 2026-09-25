import { isValidDocumentId, Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import type { ApiEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";
import type { Party } from "../../src/models/party.js";

const DEFAULT_AUTOMERGE_WSS_URL = "wss://server.trizum.app/sync";
const DEFAULT_MEMBERSHIP_TIMEOUT_MS = 10_000;
const logger = getLogger("api", "partyMembership");

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
  env,
  partyDocumentId,
  partyListDocumentId,
  request,
}: {
  env: ApiEnv;
  partyDocumentId: string;
  partyListDocumentId: string;
  request: Request;
}) {
  if (!isValidDocumentId(partyDocumentId) || !isValidDocumentId(partyListDocumentId)) {
    return false;
  }

  const partyId = partyDocumentId as DocumentId;
  const partyListId = partyListDocumentId as DocumentId;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), getMembershipTimeoutMs(env));
  let repo: Repo | undefined;

  try {
    repo = new Repo({
      isEphemeral: true,
      network: [new BrowserWebSocketClientAdapter(getAutomergeWssUrl(env, request))],
      peerId: `party-membership:${crypto.randomUUID()}` as PeerId,
      shareConfig: {
        access: (_peerId, documentId) =>
          Promise.resolve(documentId === partyListId || documentId === partyId),
        announce: (_peerId, documentId) =>
          Promise.resolve(documentId === partyListId || documentId === partyId),
      },
    });

    const partyListHandle = await repo.find<PartyListMembershipDocument>(partyListId, {
      allowableStates: ["ready"],
      signal: abortController.signal,
    });
    const partyList = partyListHandle.doc();
    const participantId = partyList?.participantInParties?.[partyId];

    if (!partyList || partyList.type !== "partyList" || partyList.parties?.[partyId] !== true) {
      return false;
    }

    if (!participantId) {
      return false;
    }

    const partyHandle = await repo.find<Party>(partyId, {
      allowableStates: ["ready"],
      signal: abortController.signal,
    });

    return isPartyMembershipValid({
      participantId,
      party: partyHandle.doc(),
      partyDocumentId,
    });
  } catch (error) {
    throw new PartyMembershipUnavailableError("Party membership could not be verified.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
    await repo?.shutdown().catch((error) => {
      logger.warning("Could not shut down Party Boost membership repo", { error });
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

function getAutomergeWssUrl(env: ApiEnv, request: Request) {
  const configuredUrl = env.AUTOMERGE_WSS_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return "wss://dev-sync.trizum.app";
  }

  return DEFAULT_AUTOMERGE_WSS_URL;
}

function getMembershipTimeoutMs(env: ApiEnv) {
  const value = env.PARTY_MEMBERSHIP_TIMEOUT_MS;
  const parsedValue = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_MEMBERSHIP_TIMEOUT_MS;
}
