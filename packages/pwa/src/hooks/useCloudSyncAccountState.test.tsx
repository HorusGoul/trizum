import { getAppData } from "#src/lib/data/client.ts";
import type { AppClient } from "#src/lib/data/LocalFateClient.ts";
// @vitest-environment jsdom

import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { i18n } from "@lingui/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type {
  setAnalyticsEnabled as setAnalyticsEnabledType,
  trackCloudSyncActivated as trackCloudSyncActivatedType,
} from "#src/lib/analytics.ts";
import type { setPartyListId as setPartyListIdType, PartyList } from "#src/models/partyList.ts";
import type { fetchLinkedAuthAccounts as fetchLinkedAuthAccountsType } from "#src/lib/auth-client.ts";
import { toast } from "sonner";
import { createUseCloudSyncAccountState } from "./useCloudSyncAccountState.ts";
import type { fetchCloudUserSettings as fetchCloudUserSettingsType } from "#src/lib/cloudSyncSettings.ts";

import { Repo } from "@automerge/automerge-repo";
import { DataHarness } from "#src/lib/testing/DataHarness.tsx";

let repo: Repo;

const readDocument =
  vi.fn<(client: AppClient, id: PartyList["id"]) => Promise<PartyList | undefined>>();

const setAnalyticsEnabled = vi.fn<typeof setAnalyticsEnabledType>();
const trackCloudSyncActivated = vi.fn<typeof trackCloudSyncActivatedType>();
const setPartyListId = vi.fn<typeof setPartyListIdType>();
const fetchLinkedAuthAccounts = vi.fn<typeof fetchLinkedAuthAccountsType>();
const fetchCloudUserSettings = vi.fn<typeof fetchCloudUserSettingsType>();

const useCloudSyncAccountState = createUseCloudSyncAccountState({
  readPartyList: readDocument,
  setAnalyticsEnabled,
  trackCloudSyncActivated,
  setPartyListId,
  fetchLinkedAuthAccounts,
  fetchCloudUserSettings,
});

function partyList(usageAnalyticsEnabled?: boolean): PartyList {
  return {
    id: parseAutomergeUrl(generateAutomergeUrl()).documentId,
    type: "partyList",
    username: "Private name",
    phone: "Private phone",
    parties: {},
    participantInParties: {},
    usageAnalyticsEnabled,
  };
}

function renderAccount(source: PartyList) {
  let account!: ReturnType<typeof useCloudSyncAccountState>;
  const onCloudDataActivated = vi.fn<(shouldDelay: boolean) => void>();

  function Harness() {
    account = useCloudSyncAccountState({
      isOffline: false,
      isSignInSuccessVisibleRef: { current: false },
      onCloudDataActivated,
      partyList: source,
      userId: "test-user",
    });

    return null;
  }

  // Effects are irrelevant to the explicit activation action under test.
  renderToStaticMarkup(
    <DataHarness value={repo}>
      <Harness />
    </DataHarness>,
  );

  return { ...account, onCloudDataActivated };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  repo = new Repo({ network: [] });
  vi.spyOn(toast, "error").mockReturnValue("error");
  vi.spyOn(toast, "message").mockReturnValue("message");
  vi.spyOn(toast, "success").mockReturnValue("success");
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React reads this optional test-only flag from the global object; production globals do not declare it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

it.each(["missing", "rejected"])(
  "resolves account loading without activating an unavailable cloud list (%s)",
  async (failure) => {
    const source = partyList();
    const destination = partyList();
    vi.mocked(fetchLinkedAuthAccounts).mockResolvedValue([]);
    vi.mocked(fetchCloudUserSettings).mockResolvedValue({
      settings: { partyListDocumentId: destination.id, updatedAt: 123 },
    });

    if (failure === "missing") {
      readDocument.mockResolvedValue(undefined);
    } else {
      readDocument.mockRejectedValue(new Error("Unavailable"));
    }

    let account!: ReturnType<typeof useCloudSyncAccountState>;
    const onCloudDataActivated = vi.fn<(shouldDelay: boolean) => void>();
    const isSignInSuccessVisibleRef = { current: false };

    function Harness() {
      account = useCloudSyncAccountState({
        isOffline: false,
        isSignInSuccessVisibleRef,
        onCloudDataActivated,
        partyList: source,
        userId: "test-user",
      });

      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      await act(async () =>
        root.render(
          <DataHarness value={repo}>
            <Harness />
          </DataHarness>,
        ),
      );
      expect(readDocument).toHaveBeenCalledWith(getAppData(repo).fate, destination.id);
      expect(account.isAccountStateResolved).toBe(true);
      expect(account.isCloudSyncSwitchOpen).toBe(false);
      expect(setPartyListId).not.toHaveBeenCalled();
      expect(onCloudDataActivated).not.toHaveBeenCalled();
      expect(setAnalyticsEnabled).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Could not load trizum cloud state");
    } finally {
      await act(async () => root.unmount());
    }
  },
);

it.each([undefined, true])("counts activation for destination preference %s", async (enabled) => {
  const destination = partyList(enabled);
  readDocument.mockResolvedValue(destination);
  const { activateCloudSyncOnDevice, onCloudDataActivated } = renderAccount(partyList());
  await activateCloudSyncOnDevice({ partyListDocumentId: destination.id, updatedAt: 123 });
  expect(setPartyListId).toHaveBeenCalledWith(destination.id);
  expect(onCloudDataActivated).toHaveBeenCalledOnce();
  expect(vi.mocked(trackCloudSyncActivated).mock.calls).toEqual([[destination.id]]);
  expect(setAnalyticsEnabled).not.toHaveBeenCalled();
});

it("disables analytics before switching to an opted-out destination", async () => {
  const destination = partyList(false);
  readDocument.mockResolvedValue(destination);
  const { activateCloudSyncOnDevice } = renderAccount(partyList());
  await activateCloudSyncOnDevice({ partyListDocumentId: destination.id, updatedAt: 123 });
  expect(setPartyListId).toHaveBeenCalledWith(destination.id);
  expect(trackCloudSyncActivated).not.toHaveBeenCalled();
  expect(setAnalyticsEnabled).toHaveBeenCalledWith(false);
  expect(vi.mocked(setAnalyticsEnabled).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(setPartyListId).mock.invocationCallOrder[0],
  );
});

it("does not enable analytics or emit activation when the source list opted out", async () => {
  const destination = partyList(true);
  readDocument.mockResolvedValue(destination);
  const { activateCloudSyncOnDevice } = renderAccount(partyList(false));
  await activateCloudSyncOnDevice({ partyListDocumentId: destination.id, updatedAt: 123 });
  expect(setPartyListId).toHaveBeenCalledWith(destination.id);
  expect(trackCloudSyncActivated).not.toHaveBeenCalled();
  expect(setAnalyticsEnabled).not.toHaveBeenCalled();
});

it("does not count an already active list, unavailable list, or failed load", async () => {
  const source = partyList();
  const { activateCloudSyncOnDevice } = renderAccount(source);
  await activateCloudSyncOnDevice({ partyListDocumentId: source.id, updatedAt: 123 });
  expect(readDocument).not.toHaveBeenCalled();
  const settings = { partyListDocumentId: partyList().id, updatedAt: 123 };
  readDocument.mockResolvedValue(undefined);
  await activateCloudSyncOnDevice(settings);
  readDocument.mockRejectedValue(new Error("Unavailable"));
  await expect(activateCloudSyncOnDevice(settings)).rejects.toThrow("Unavailable");
  expect(setPartyListId).not.toHaveBeenCalled();
  expect(trackCloudSyncActivated).not.toHaveBeenCalled();
});

afterEach(async () => {
  await repo.shutdown();
  localStorage.clear();
  vi.restoreAllMocks();
});
