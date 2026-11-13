import { z } from "zod";
import { cloudUserSettingsSchema } from "./api/cloudSyncContract.ts";
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
    Object.values(partyList.paymentMethods ?? {}).some((details) => details?.trim()) ||
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

    const cachedValue: unknown = JSON.parse(value);

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

function hasRecordData<Value>(record: Record<string, Value> | undefined) {
  return Object.values(record ?? {}).some(Boolean);
}

function getCloudAccountStateCacheKey(userId: string) {
  return `${CLOUD_ACCOUNT_STATE_CACHE_KEY_PREFIX}${userId}`;
}

const cachedCloudAccountStateSchema = z.object({
  cachedAt: z.number(),
  cloudSettings: cloudUserSettingsSchema.nullable(),
  linkedAccounts: z.array(
    z.object({ accountId: z.string(), id: z.string(), providerId: z.string(), userId: z.string() }),
  ),
});

function isCachedCloudAccountState(value: unknown): value is CachedCloudAccountState {
  return cachedCloudAccountStateSchema.safeParse(value).success;
}
