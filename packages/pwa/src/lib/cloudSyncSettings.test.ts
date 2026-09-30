import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  clearCachedCloudUserSettings,
  fetchCloudUserSettings,
  readCachedCloudUserSettings,
  readLastCachedCloudUserSettings,
  saveCloudUserSettings,
  writeCachedCloudUserSettings,
} from "./cloudSyncSettings";
import { CloudSyncApiError, trizumApiClient } from "./trizumApiClient";

describe("Cloud Sync settings compatibility", () => {
  const settings = {
    partyListDocumentId: parseAutomergeUrl(generateAutomergeUrl()).documentId,
    updatedAt: 123,
  };

  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("retains signed-out read and write behavior", async () => {
    vi.spyOn(trizumApiClient.cloudSync, "getSettings").mockRejectedValue(
      new CloudSyncApiError(401, "Unauthorized"),
    );
    vi.spyOn(trizumApiClient.cloudSync, "saveSettings").mockRejectedValue(
      new CloudSyncApiError(401, "Unauthorized"),
    );
    await expect(fetchCloudUserSettings()).resolves.toEqual({
      settings: null,
      status: "unauthenticated",
    });
    await expect(saveCloudUserSettings(settings)).rejects.toThrow(
      "Sign in before syncing settings.",
    );
  });

  test("retains cached settings when the network fails", async () => {
    writeCachedCloudUserSettings("alice", settings);
    vi.spyOn(trizumApiClient.cloudSync, "getSettings").mockRejectedValue(new TypeError("Offline"));
    await expect(fetchCloudUserSettings()).rejects.toThrow("Failed to load trizum cloud settings.");
    expect(readCachedCloudUserSettings("alice")?.settings).toEqual(settings);
    expect(readLastCachedCloudUserSettings()?.settings).toEqual(settings);
    expect(readCachedCloudUserSettings("bob")).toBeNull();
  });

  test("preserves the existing save error message with the typed conflict as its cause", async () => {
    const conflict = new CloudSyncApiError(409, "trizum cloud is already set up for this account.");
    vi.spyOn(trizumApiClient.cloudSync, "saveSettings").mockRejectedValue(conflict);
    await expect(saveCloudUserSettings(settings)).rejects.toMatchObject({
      message: "Failed to save trizum cloud settings.",
      cause: conflict,
    });
  });

  test("keeps the v1 cache format, unset state and clearing behavior", () => {
    localStorage.setItem(
      "trizumCloudUserSettings:v1:alice",
      JSON.stringify({ cachedAt: 123, settings }),
    );
    expect(readCachedCloudUserSettings("alice")).toEqual({ cachedAt: 123, settings });
    writeCachedCloudUserSettings("alice", null);
    expect(readCachedCloudUserSettings("alice")?.settings).toBeNull();
    expect(readLastCachedCloudUserSettings()?.settings).toBeNull();
    clearCachedCloudUserSettings("alice");
    expect(readCachedCloudUserSettings("alice")).toBeNull();
    expect(readLastCachedCloudUserSettings()).toBeNull();
  });

  test("ignores corrupt or unavailable storage", () => {
    localStorage.setItem("trizumCloudUserSettings:v1:alice", "{");
    expect(readCachedCloudUserSettings("alice")).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Unavailable");
      },
    });
    expect(readCachedCloudUserSettings("alice")).toBeNull();
    expect(() => writeCachedCloudUserSettings("alice", settings)).not.toThrow();
  });
});
