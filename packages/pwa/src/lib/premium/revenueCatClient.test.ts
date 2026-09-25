import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const revenueCat = vi.hoisted(() => ({
  configure: vi.fn<(options: { appUserID: string }) => Promise<void>>(),
  getCustomerInfo: vi.fn<() => Promise<{ customerInfo: { id: string } }>>(),
  logIn: vi.fn<(options: { appUserID: string }) => Promise<{ customerInfo: { id: string } }>>(),
  logOut: vi.fn<() => Promise<{ customerInfo: { id: string } }>>(),
  setLogLevel: vi.fn<(options: { level: string }) => Promise<void>>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "ios",
    isNativePlatform: () => true,
  },
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  LOG_LEVEL: { DEBUG: "DEBUG", WARN: "WARN" },
  Purchases: revenueCat,
}));

describe("RevenueCat identity", () => {
  beforeEach(() => {
    vi.resetModules();
    revenueCat.configure.mockReset().mockResolvedValue(undefined);
    revenueCat.getCustomerInfo.mockReset().mockResolvedValue({ customerInfo: { id: "first" } });
    revenueCat.logIn.mockReset().mockResolvedValue({ customerInfo: { id: "second" } });
    revenueCat.logOut.mockReset().mockResolvedValue({ customerInfo: { id: "anonymous" } });
    revenueCat.setLogLevel.mockReset().mockResolvedValue(undefined);
  });

  it("switches identified accounts directly without creating an anonymous user", async () => {
    const { synchronizeRevenueCatUser } = await import("./revenueCatClient.ts");

    await synchronizeRevenueCatUser("user-1");
    await synchronizeRevenueCatUser("user-2");

    expect(revenueCat.configure).toHaveBeenCalledWith(
      expect.objectContaining({ appUserID: "user-1" }),
    );
    expect(revenueCat.logIn).toHaveBeenCalledWith({ appUserID: "user-2" });
    expect(revenueCat.logOut).not.toHaveBeenCalled();
  });

  it("logs out only when the trizum session is cleared", async () => {
    const { clearRevenueCatUser, synchronizeRevenueCatUser } =
      await import("./revenueCatClient.ts");

    await synchronizeRevenueCatUser("user-1");
    await clearRevenueCatUser();

    expect(revenueCat.logOut).toHaveBeenCalledOnce();
  });
});
