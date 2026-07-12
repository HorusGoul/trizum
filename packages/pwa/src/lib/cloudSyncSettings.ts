import { isValidDocumentId, type DocumentId } from "@automerge/automerge-repo/slim";
import type { PartyList } from "#src/models/partyList.js";
import { getAuthBaseURL } from "./auth-client";
import { fetchWithNativeAuth } from "./nativeAuthSession";

const CLOUD_USER_SETTINGS_CACHE_KEY_PREFIX = "trizumCloudUserSettings:v1:";
const LAST_CLOUD_USER_SETTINGS_CACHE_KEY = "trizumCloudUserSettings:last:v1";

export interface CloudUserSettings {
  partyListDocumentId: DocumentId;
  updatedAt: number;
}

export interface CachedCloudUserSettings {
  cachedAt: number;
  settings: CloudUserSettings | null;
}

export interface CloudUserSettingsInput {
  partyListDocumentId: DocumentId;
}

export function getCloudUserSettingsInput(partyList: PartyList): CloudUserSettingsInput {
  return {
    partyListDocumentId: partyList.id,
  };
}

export async function fetchCloudUserSettings() {
  const response = await fetchWithNativeAuth(getCloudSyncSettingsURL());

  if (response.status === 401) {
    return { settings: null, status: "unauthenticated" as const };
  }

  if (!response.ok) {
    throw new Error("Failed to load trizum cloud settings.");
  }

  return (await response.json()) as {
    settings: CloudUserSettings | null;
  };
}

export async function saveCloudUserSettings(settings: CloudUserSettingsInput) {
  const response = await fetchWithNativeAuth(getCloudSyncSettingsURL(), {
    body: JSON.stringify(settings),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (response.status === 401) {
    throw new Error("Sign in before syncing settings.");
  }

  if (!response.ok) {
    throw new Error("Failed to save trizum cloud settings.");
  }

  return (await response.json()) as {
    settings: CloudUserSettings;
  };
}

export function readCachedCloudUserSettings(userId: string) {
  try {
    const value = localStorage.getItem(getCloudUserSettingsCacheKey(userId));

    if (!value) {
      return null;
    }

    const cachedValue = JSON.parse(value) as Partial<CachedCloudUserSettings> | null;

    if (!isCachedCloudUserSettings(cachedValue)) {
      return null;
    }

    return cachedValue;
  } catch {
    return null;
  }
}

export function readLastCachedCloudUserSettings() {
  try {
    const value = localStorage.getItem(LAST_CLOUD_USER_SETTINGS_CACHE_KEY);

    if (!value) {
      return null;
    }

    const cachedValue = JSON.parse(value) as Partial<CachedCloudUserSettings> | null;

    if (!isCachedCloudUserSettings(cachedValue)) {
      return null;
    }

    return cachedValue;
  } catch {
    return null;
  }
}

export function writeCachedCloudUserSettings(userId: string, settings: CloudUserSettings | null) {
  const cachedSettings = {
    cachedAt: Date.now(),
    settings,
  } satisfies CachedCloudUserSettings;

  try {
    localStorage.setItem(getCloudUserSettingsCacheKey(userId), JSON.stringify(cachedSettings));
    localStorage.setItem(LAST_CLOUD_USER_SETTINGS_CACHE_KEY, JSON.stringify(cachedSettings));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function clearCachedCloudUserSettings(userId: string) {
  try {
    localStorage.removeItem(getCloudUserSettingsCacheKey(userId));
    localStorage.removeItem(LAST_CLOUD_USER_SETTINGS_CACHE_KEY);
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function getCloudSyncSettingsURL() {
  return new URL("/api/cloud-sync/settings", getAuthBaseURL()).toString();
}

function getCloudUserSettingsCacheKey(userId: string) {
  return `${CLOUD_USER_SETTINGS_CACHE_KEY_PREFIX}${userId}`;
}

function isCachedCloudUserSettings(
  value: Partial<CachedCloudUserSettings> | null,
): value is CachedCloudUserSettings {
  if (!value || typeof value.cachedAt !== "number") {
    return false;
  }

  const { settings } = value;

  return (
    settings === null ||
    (typeof settings === "object" &&
      typeof settings.updatedAt === "number" &&
      typeof settings.partyListDocumentId === "string" &&
      isValidDocumentId(settings.partyListDocumentId))
  );
}
