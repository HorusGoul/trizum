import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const assign = vi.fn<(url: string) => void>();

import {
  createRevenueCatStore,
  createCustomerInfo,
  createEntitlement,
} from "./revenueCatTestFixtures.ts";
import { createRevenueCatClient } from "./revenueCatClient.ts";
import type { RevenueCatPlatform } from "./revenueCatConfig.ts";

interface StorePlatform {
  platform: RevenueCatPlatform | undefined;
}

const platformState: StorePlatform = { platform: "ios" };
const store = Object.assign(createRevenueCatStore(), platformState);

let client = createClient();

function createClient() {
  return createRevenueCatClient({
    getStore: async () => store,
    getPlatform: () => store.platform,
    getPublicApiKey: () => "public-test-key",
  });
}

beforeEach(() => {
  client = createClient();
  vi.clearAllMocks();
  store.platform = "ios";
  store.logIn.mockResolvedValue({ customerInfo: createCustomerInfo(), created: false });
  store.getCustomerInfo.mockResolvedValue({ customerInfo: createCustomerInfo() });
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("window", { location: { assign } });
});

afterEach(() => vi.unstubAllGlobals());

it("identifies the account before opening Apple's native sheet", async () => {
  const { openPremiumCodeRedemption } = client;
  await openPremiumCodeRedemption("friend", "");
  expect(store.configure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: "friend" }));
  expect(store.configure.mock.invocationCallOrder[0]).toBeLessThan(
    store.presentCodeRedemptionSheet.mock.invocationCallOrder[0]!,
  );
  expect(store.presentCodeRedemptionSheet).toHaveBeenCalledOnce();
  expect(assign).not.toHaveBeenCalled();
});

it.each(["ios", "android"] as const)(
  "opens the documented %s link with a prefilled code",
  async (platform) => {
    store.platform = platform;
    const { openPremiumCodeRedemption } = client;
    await openPremiumCodeRedemption("friend", "FRIENDS");
    const url = new URL(assign.mock.calls[0]![0].toString());
    expect(url.hostname).toBe(platform === "ios" ? "apps.apple.com" : "play.google.com");
    expect(url.searchParams.get("code")).toBe("FRIENDS");
  },
);

it("does not open a store before sign-in or on web", async () => {
  const { openPremiumCodeRedemption } = client;
  await expect(openPremiumCodeRedemption(null, "FRIENDS")).rejects.toThrow("signed-in");
  store.platform = undefined;
  await expect(openPremiumCodeRedemption("friend", "FRIENDS")).rejects.toThrow("native store");
  expect(assign).not.toHaveBeenCalled();
  expect(store.configure).not.toHaveBeenCalled();
});

it("syncs external purchases on refresh, retries delayed receipts, and stops once Premium arrives", async () => {
  const { openPremiumCodeRedemption, refreshRevenueCatCustomerInfo } = client;

  await openPremiumCodeRedemption("friend", "FRIENDS");
  await refreshRevenueCatCustomerInfo();
  expect(store.syncPurchases).toHaveBeenCalledOnce();

  const customerInfo = createCustomerInfo({
    entitlements: {
      ...createCustomerInfo().entitlements,
      active: { premium: createEntitlement() },
    },
  });

  store.getCustomerInfo.mockResolvedValue({ customerInfo });
  expect(await refreshRevenueCatCustomerInfo()).toBe(customerInfo);
  await refreshRevenueCatCustomerInfo();
  expect(store.syncPurchases).toHaveBeenCalledTimes(2);
  expect(store.invalidateCustomerInfoCache).toHaveBeenCalledTimes(2);
});

it("preserves SDK-cached access if receipt sync fails offline", async () => {
  const { openPremiumCodeRedemption, refreshRevenueCatCustomerInfo } = client;

  await openPremiumCodeRedemption("friend", "FRIENDS");
  store.syncPurchases.mockRejectedValue(new Error("offline"));
  await expect(refreshRevenueCatCustomerInfo()).resolves.toEqual(createCustomerInfo());
});

it("does not sync a pending redemption into a different account", async () => {
  const { openPremiumCodeRedemption, prepareRevenueCatUser, refreshRevenueCatCustomerInfo } =
    client;

  await openPremiumCodeRedemption("friend", "FRIENDS");
  await prepareRevenueCatUser("other");
  await refreshRevenueCatCustomerInfo();
  expect(store.syncPurchases).not.toHaveBeenCalled();
});
