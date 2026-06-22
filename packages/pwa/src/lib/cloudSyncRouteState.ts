import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import type { LinkedAuthAccount } from "#src/lib/auth-client.ts";
import type { CloudUserSettings } from "#src/lib/cloudSyncSettings.ts";
import type { PartyList } from "#src/models/partyList.js";

const CLOUD_ACCOUNT_STATE_CACHE_KEY_PREFIX = "trizumCloudAccountState:";

interface CachedCloudAccountState {
  cachedAt: number;
  cloudSettings: CloudUserSettings | null;
  linkedAccounts: LinkedAuthAccount[];
}

export function hasLocalPartyListData(partyList: PartyList) {
  return (
    hasRecordData(partyList.parties) ||
    hasRecordData(partyList.pinnedParties) ||
    hasRecordData(partyList.archivedParties) ||
    hasRecordData(partyList.lastUsedAt) ||
    Boolean(partyList.lastOpenedPartyId) ||
    Boolean(partyList.username.trim()) ||
    Boolean(partyList.phone.trim()) ||
    Boolean(partyList.avatarId) ||
    Boolean(partyList.locale) ||
    partyList.openLastPartyOnLaunch === true ||
    partyList.autoOpenCalculator === true ||
    partyList.hue !== undefined
  );
}

export function readCachedCloudAccountState(userId: string) {
  try {
    const value = localStorage.getItem(getCloudAccountStateCacheKey(userId));

    if (!value) {
      return null;
    }

    const cachedValue = JSON.parse(value) as Partial<CachedCloudAccountState> | null;

    if (!isCachedCloudAccountState(cachedValue)) {
      return null;
    }

    return cachedValue;
  } catch {
    return null;
  }
}

export function writeCachedCloudAccountState(
  userId: string,
  state: Omit<CachedCloudAccountState, "cachedAt">,
) {
  try {
    localStorage.setItem(
      getCloudAccountStateCacheKey(userId),
      JSON.stringify({
        ...state,
        cachedAt: Date.now(),
      } satisfies CachedCloudAccountState),
    );
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function clearCachedCloudAccountState(userId: string) {
  try {
    localStorage.removeItem(getCloudAccountStateCacheKey(userId));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function isEmailFieldErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("email") &&
    !normalizedMessage.includes("password") &&
    (normalizedMessage.includes("invalid") ||
      normalizedMessage.includes("valid") ||
      normalizedMessage.includes("required"))
  );
}

export function isPasswordFieldErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("password") &&
    !normalizedMessage.includes("email") &&
    (normalizedMessage.includes("invalid") ||
      normalizedMessage.includes("required") ||
      normalizedMessage.includes("short") ||
      normalizedMessage.includes("least"))
  );
}

function hasRecordData(record: Record<string, unknown> | undefined) {
  return Object.values(record ?? {}).some(Boolean);
}

function getCloudAccountStateCacheKey(userId: string) {
  return `${CLOUD_ACCOUNT_STATE_CACHE_KEY_PREFIX}${userId}`;
}

function isCachedCloudAccountState(
  value: Partial<CachedCloudAccountState> | null,
): value is CachedCloudAccountState {
  if (!value || typeof value.cachedAt !== "number") {
    return false;
  }

  return (
    (value.cloudSettings === null ||
      (typeof value.cloudSettings === "object" &&
        typeof value.cloudSettings.updatedAt === "number" &&
        typeof value.cloudSettings.partyListDocumentId === "string" &&
        isValidDocumentId(value.cloudSettings.partyListDocumentId))) &&
    Array.isArray(value.linkedAccounts) &&
    value.linkedAccounts.every(isLinkedAuthAccount)
  );
}

function isLinkedAuthAccount(value: unknown): value is LinkedAuthAccount {
  if (!value || typeof value !== "object") {
    return false;
  }

  const account = value as Partial<LinkedAuthAccount>;

  return (
    typeof account.accountId === "string" &&
    typeof account.id === "string" &&
    typeof account.providerId === "string" &&
    typeof account.userId === "string"
  );
}
