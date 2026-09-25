import { getAuthBaseURL } from "#src/lib/auth-client.ts";
import { fetchWithNativeAuth } from "#src/lib/nativeAuthSession.ts";
import type { PartyBoostErrorCode, PartyBoostStatus } from "./partyBoostTypes.ts";

export type {
  PartyBoostAssignmentStatus,
  PartyBoostErrorCode,
  PartyBoostRevocationReason,
  PartyBoostStatus,
} from "./partyBoostTypes.ts";

export class PartyBoostApiError extends Error {
  readonly code: PartyBoostErrorCode;
  readonly transferableAt?: number;

  constructor({
    code,
    message,
    transferableAt,
  }: {
    code: PartyBoostErrorCode;
    message: string;
    transferableAt?: number;
  }) {
    super(message);
    this.code = code;
    this.name = "PartyBoostApiError";
    this.transferableAt = transferableAt;
  }
}

export async function fetchPartyBoostStatus(partyDocumentId: string) {
  const url = new URL("/api/premium/party-boost", getAuthBaseURL());
  url.searchParams.set("partyDocumentId", partyDocumentId);

  return requestPartyBoostStatus(url, { method: "GET" });
}

export async function activatePartyBoost(partyDocumentId: string) {
  return requestPartyBoostStatus(new URL("/api/premium/party-boost", getAuthBaseURL()), {
    body: JSON.stringify({ partyDocumentId }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

async function requestPartyBoostStatus(url: URL, init: RequestInit) {
  const response = await fetchWithNativeAuth(url, init);
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw parsePartyBoostError(body);
  }

  if (!isPartyBoostStatus(body)) {
    throw new PartyBoostApiError({
      code: "unavailable",
      message: "Party Boost returned an invalid response.",
    });
  }

  return body;
}

function parsePartyBoostError(body: unknown) {
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const candidate = error as Record<string, unknown>;
      if (isPartyBoostErrorCode(candidate.code) && typeof candidate.message === "string") {
        return new PartyBoostApiError({
          code: candidate.code,
          message: candidate.message,
          transferableAt:
            typeof candidate.transferableAt === "number" ? candidate.transferableAt : undefined,
        });
      }
    }
  }

  return new PartyBoostApiError({ code: "unavailable", message: "Party Boost is unavailable." });
}

export function isPartyBoostStatus(value: unknown): value is PartyBoostStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { currentUser?: unknown; party?: unknown };
  if (
    !candidate.currentUser ||
    typeof candidate.currentUser !== "object" ||
    !candidate.party ||
    typeof candidate.party !== "object"
  ) {
    return false;
  }

  const currentUser = candidate.currentUser as Record<string, unknown>;
  const party = candidate.party as Record<string, unknown>;
  return (
    typeof currentUser.isPremium === "boolean" &&
    (currentUser.assignment === null || isPartyBoostAssignment(currentUser.assignment)) &&
    typeof party.isBoosted === "boolean" &&
    typeof party.isBoostedByCurrentUser === "boolean"
  );
}

function isPartyBoostAssignment(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const assignment = value as Record<string, unknown>;
  return (
    typeof assignment.active === "boolean" &&
    typeof assignment.assignedAt === "number" &&
    typeof assignment.partyDocumentId === "string" &&
    (assignment.revocationReason === null ||
      assignment.revocationReason === "owner_not_member" ||
      assignment.revocationReason === "premium_inactive") &&
    (assignment.revokedAt === null || typeof assignment.revokedAt === "number") &&
    typeof assignment.transferableAt === "number"
  );
}

function isPartyBoostErrorCode(value: unknown): value is PartyBoostErrorCode {
  return (
    value === "already_boosted" ||
    value === "invalid_party" ||
    value === "membership_required" ||
    value === "premium_required" ||
    value === "transfer_locked" ||
    value === "unauthorized" ||
    value === "unavailable"
  );
}
