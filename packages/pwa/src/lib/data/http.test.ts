// @vitest-environment jsdom
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { expect, test, vi } from "vite-plus/test";
import { createFateApiClient } from "./http.ts";
import { PartyBoostApiError, type TrizumApiClient } from "../trizumApiClient.ts";
import type { GetCloudUserSettingsResponse } from "../api/cloudSyncContract.ts";

function source(): TrizumApiClient {
  async function unused(): Promise<never> {
    throw new Error("Unexpected source operation");
  }

  return {
    cloudSync: { getSettings: unused, saveSettings: unused },
    premium: { getPartyBoostStatus: unused, activatePartyBoost: unused },
    migration: { importTricount: unused },
  };
}

test("Fate shares concurrent account reads and refreshes completed reads", async () => {
  const current = source();
  const pending = deferred<GetCloudUserSettingsResponse>();
  const getSettings = vi.fn<TrizumApiClient["cloudSync"]["getSettings"]>(() => pending.promise);
  current.cloudSync.getSettings = getSettings;
  const client = createFateApiClient(current);
  const first = client.cloudSync.getSettings();
  const second = client.cloudSync.getSettings();
  pending.resolve({ settings: null });
  expect(await first).toEqual({ settings: null });
  expect(await second).toEqual({ settings: null });
  expect(getSettings).toHaveBeenCalledTimes(1);

  const next = {
    settings: {
      partyListDocumentId: parseAutomergeUrl(generateAutomergeUrl()).documentId,
      updatedAt: 123,
    },
  };

  getSettings.mockResolvedValueOnce(next);
  expect(await client.cloudSync.getSettings()).toEqual(next);
  expect(getSettings).toHaveBeenCalledTimes(2);
});

test("Fate preserves typed server mutation errors", async () => {
  const current = source();
  const rejected = new PartyBoostApiError({ code: "unavailable", message: "Try again" });
  current.premium.activatePartyBoost = vi
    .fn<TrizumApiClient["premium"]["activatePartyBoost"]>()
    .mockRejectedValue(rejected);
  await expect(createFateApiClient(current).premium.activatePartyBoost("party")).rejects.toBe(
    rejected,
  );
});

test("an account switch never shares an in-flight read from the previous account", async () => {
  const current = source();
  const oldRead = deferred<GetCloudUserSettingsResponse>();
  const newRead = deferred<GetCloudUserSettingsResponse>();

  const getSettings = vi
    .fn<TrizumApiClient["cloudSync"]["getSettings"]>()
    .mockReturnValueOnce(oldRead.promise)
    .mockReturnValueOnce(newRead.promise);

  current.cloudSync.getSettings = getSettings;
  let account = "first";
  const client = createFateApiClient(current, () => account);
  const previous = client.cloudSync.getSettings();
  await vi.waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1));
  account = "second";
  const next = client.cloudSync.getSettings();
  await vi.waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2));
  newRead.resolve({ settings: null });
  expect(await next).toEqual({ settings: null });
  oldRead.resolve({
    settings: {
      partyListDocumentId: parseAutomergeUrl(generateAutomergeUrl()).documentId,
      updatedAt: 1,
    },
  });
  expect((await previous).settings).not.toBeNull();
});

function deferred<Value>() {
  let resolve!: (value: Value) => void;

  const promise = new Promise<Value>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}
