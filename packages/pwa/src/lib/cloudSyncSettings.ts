import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { PartyList } from "#src/models/partyList.js";
import { getAuthBaseURL } from "./auth-client";

export interface CloudUserSettings {
  partyListDocumentId: DocumentId;
  updatedAt: number;
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
