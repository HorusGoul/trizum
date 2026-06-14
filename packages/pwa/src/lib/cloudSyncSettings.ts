import type { PartyList } from "#src/models/partyList.js";
import { getAuthBaseURL } from "./auth-client";
import { defaultThemeHue } from "#src/ui/theme.ts";

export interface CloudUserSettings {
  autoOpenCalculator: boolean;
  hue: number;
  locale: "en" | "es" | null;
  openLastPartyOnLaunch: boolean;
  phone: string;
  updatedAt: number;
  username: string;
}

export interface CloudUserSettingsInput {
  autoOpenCalculator: boolean;
  hue: number;
  locale: "en" | "es" | null;
  openLastPartyOnLaunch: boolean;
  phone: string;
  username: string;
}

export function getCloudUserSettingsInput(partyList: PartyList): CloudUserSettingsInput {
  return {
    autoOpenCalculator: partyList.autoOpenCalculator ?? false,
    hue: partyList.hue ?? defaultThemeHue,
    locale: partyList.locale ?? null,
    openLastPartyOnLaunch: partyList.openLastPartyOnLaunch ?? false,
    phone: partyList.phone ?? "",
    username: partyList.username ?? "",
  };
}

export async function fetchCloudUserSettings() {
  const response = await fetch(getCloudSyncSettingsURL(), {
    credentials: "include",
  });

  if (response.status === 401) {
    return { settings: null, status: "unauthenticated" as const };
  }

  if (!response.ok) {
    throw new Error("Failed to load cloud settings.");
  }

  return (await response.json()) as {
    settings: CloudUserSettings | null;
  };
}

export async function saveCloudUserSettings(settings: CloudUserSettingsInput) {
  const response = await fetch(getCloudSyncSettingsURL(), {
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
    throw new Error("Failed to save cloud settings.");
  }

  return (await response.json()) as {
    settings: CloudUserSettings;
  };
}

function getCloudSyncSettingsURL() {
  return new URL("/api/cloud-sync/settings", getAuthBaseURL()).toString();
}
