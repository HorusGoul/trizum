import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createRevenueCatStore, createCustomerInfo } from "./revenueCatTestFixtures.ts";
import { createRevenueCatClient } from "./revenueCatClient.ts";

const revenueCat = createRevenueCatStore();
let client = createClient();

function createClient() {
  return createRevenueCatClient({
    getStore: async () => revenueCat,
    getPlatform: () => "ios",
    getPublicApiKey: () => "public-test-key",
  });
}

describe("RevenueCat identity", () => {
  beforeEach(() => {
    client = createClient();
    revenueCat.configure.mockReset().mockResolvedValue(undefined);
    revenueCat.getCustomerInfo
      .mockReset()
      .mockResolvedValue({ customerInfo: createCustomerInfo({ originalAppUserId: "first" }) });
    revenueCat.logIn.mockReset().mockResolvedValue({
      customerInfo: createCustomerInfo({ originalAppUserId: "second" }),
      created: false,
    });
    revenueCat.logOut
      .mockReset()
      .mockResolvedValue({ customerInfo: createCustomerInfo({ originalAppUserId: "anonymous" }) });
    revenueCat.setLogLevel.mockReset().mockResolvedValue(undefined);
  });

  it("switches identified accounts directly without creating an anonymous user", async () => {
    const { synchronizeRevenueCatUser } = client;

    await synchronizeRevenueCatUser("user-1");
    await synchronizeRevenueCatUser("user-2");

    expect(revenueCat.configure).toHaveBeenCalledWith(
      expect.objectContaining({ appUserID: "user-1" }),
    );
    expect(revenueCat.logIn).toHaveBeenCalledWith({ appUserID: "user-2" });
    expect(revenueCat.logOut).not.toHaveBeenCalled();
  });

  it("logs out only when the trizum session is cleared", async () => {
    const { clearRevenueCatUser, synchronizeRevenueCatUser } = client;

    await synchronizeRevenueCatUser("user-1");
    await clearRevenueCatUser();

    expect(revenueCat.logOut).toHaveBeenCalledOnce();
  });

  it("reads SDK-cached access for a remembered account without logging in or out", async () => {
    const cachedInfo = createCustomerInfo({ originalAppUserId: "cached-premium" });
    revenueCat.getCustomerInfo.mockResolvedValue({ customerInfo: cachedInfo });
    revenueCat.logIn.mockRejectedValue(new Error("offline"));
    revenueCat.logOut.mockRejectedValue(new Error("offline"));
    const { synchronizeRevenueCatUser } = client;

    expect(await synchronizeRevenueCatUser("remembered-user")).toEqual(cachedInfo);
    expect(await synchronizeRevenueCatUser("remembered-user")).toEqual(cachedInfo);
    expect(revenueCat.configure).toHaveBeenCalledOnce();
    expect(revenueCat.configure).toHaveBeenCalledWith(
      expect.objectContaining({ appUserID: "remembered-user" }),
    );
    expect(revenueCat.logIn).not.toHaveBeenCalled();
    expect(revenueCat.logOut).not.toHaveBeenCalled();
  });
});
