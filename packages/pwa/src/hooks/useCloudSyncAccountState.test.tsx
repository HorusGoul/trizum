import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { i18n } from "@lingui/core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { setAnalyticsEnabled, trackCloudSyncActivated } from "#src/lib/analytics.ts";
import type { documentCache } from "#src/lib/automerge/suspense-hooks.ts";
import { setPartyListId, type PartyList } from "#src/models/partyList.ts";
import type * as CloudSettings from "#src/lib/cloudSyncSettings.ts";
import type * as CloudRouteState from "#src/lib/cloudSyncRouteState.ts";
import type { fetchLinkedAuthAccounts } from "#src/lib/auth-client.ts";
import type { toast } from "sonner";
import { useCloudSyncAccountState } from "./useCloudSyncAccountState.ts";

const readDocument = vi.hoisted(() => vi.fn<typeof documentCache.readAsync>());

vi.mock("#src/lib/analytics.ts", () => ({
  setAnalyticsEnabled: vi.fn<typeof setAnalyticsEnabled>(),
  trackCloudSyncActivated: vi.fn<typeof trackCloudSyncActivated>(),
}));
vi.mock("#src/lib/automerge/useRepo.ts", () => ({ useRepo: () => ({}) }));
vi.mock("#src/lib/automerge/suspense-hooks.ts", () => ({
  documentCache: { readAsync: readDocument },
}));
vi.mock("#src/models/partyList.js", () => ({ setPartyListId: vi.fn<typeof setPartyListId>() }));
vi.mock("#src/lib/auth-client.ts", () => ({
  fetchLinkedAuthAccounts: vi.fn<typeof fetchLinkedAuthAccounts>(),
}));
vi.mock("#src/lib/cloudSyncSettings.ts", () => ({
  fetchCloudUserSettings: vi.fn<typeof CloudSettings.fetchCloudUserSettings>(),
  getCloudUserSettingsInput: vi.fn<typeof CloudSettings.getCloudUserSettingsInput>(),
  saveCloudUserSettings: vi.fn<typeof CloudSettings.saveCloudUserSettings>(),
  writeCachedCloudUserSettings: vi.fn<typeof CloudSettings.writeCachedCloudUserSettings>(),
}));
vi.mock("#src/lib/cloudSyncRouteState.ts", () => ({
  hasLocalPartyListData: vi.fn<typeof CloudRouteState.hasLocalPartyListData>(),
  readCachedCloudAccountState: vi.fn<typeof CloudRouteState.readCachedCloudAccountState>(),
  writeCachedCloudAccountState: vi.fn<typeof CloudRouteState.writeCachedCloudAccountState>(),
}));
vi.mock("sonner", () => ({
  toast: {
    message: vi.fn<typeof toast.message>(),
    error: vi.fn<typeof toast.error>(),
    success: vi.fn<typeof toast.success>(),
  },
}));

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
  renderToStaticMarkup(<Harness />);
  return { ...account, onCloudDataActivated };
}

beforeEach(() => {
  vi.resetAllMocks();
  i18n.load("en", {});
  i18n.activate("en");
});

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
