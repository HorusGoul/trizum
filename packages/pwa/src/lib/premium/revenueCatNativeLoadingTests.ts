import { afterAll, beforeAll, expect, it, vi } from "vite-plus/test";
import type { PurchasesPlugin } from "@revenuecat/purchases-capacitor";

type NativePurchaseResult = Awaited<
  ReturnType<PurchasesPlugin["getCustomerInfo"] | PurchasesPlugin["getOfferings"]>
>;

export function testRevenueCatNativeLoading(platform: "ios" | "android") {
  afterAll(() => vi.unstubAllGlobals());
  const nativePromise = vi.fn<(plugin: string, method: string) => Promise<NativePurchaseResult>>();

  beforeAll(async () => {
    vi.stubGlobal("androidBridge", platform === "android" ? {} : undefined);
    vi.stubGlobal("webkit", platform === "ios" ? { messageHandlers: { bridge: {} } } : undefined);
    vi.stubGlobal("Capacitor", {
      PluginHeaders: [
        {
          name: "Purchases",
          methods: [
            "setLogLevel",
            "configure",
            "getOfferings",
            "purchasePackage",
            "restorePurchases",
          ].map((name) => ({ name, rtype: "promise" })),
        },
      ],
      nativePromise,
    });

    const { createCustomerInfo, createOffering, createPurchasesPackage } =
      await import("./revenueCatTestFixtures.ts");

    nativePromise.mockImplementation(async (_plugin: string, method: string) => {
      if (method === "getOfferings") {
        return { current: createOffering({ monthly: createPurchasesPackage() }), all: {} };
      }

      return { customerInfo: createCustomerInfo() };
    });
  });

  it(`loads the real Purchases plugin for account synchronization on ${platform}`, async () => {
    const { createRevenueCatClient } = await import("./revenueCatClient.ts");
    const client = createRevenueCatClient({ getPublicApiKey: () => "public-test-key" });
    const preparation = client.prepareRevenueCatUser("test-user");

    await vi.waitFor(
      () => {
        expect(nativePromise).toHaveBeenCalledWith(
          "Purchases",
          "configure",
          expect.objectContaining({ appUserID: "test-user" }),
        );
      },
      { timeout: 500 },
    );
    await preparation;
  });

  it(`loads the real Purchases plugin for offerings, purchases and restores on ${platform}`, async () => {
    const { createPremiumCommerce } = await import("./premiumCommerce.ts");

    const commerce = createPremiumCommerce({
      synchronizeUser: async () => undefined,
      getPlatform: () => platform,
      isTestStoreEnabled: () => false,
    });

    const loading = commerce.loadPremiumOffering("test-user");

    await vi.waitFor(
      () => {
        expect(nativePromise).toHaveBeenCalledWith("Purchases", "getOfferings", undefined);
      },
      { timeout: 500 },
    );
    const offering = await loading;
    expect(offering.plans).toEqual([
      { id: "monthly", price: "$4.99", pricePerMonth: null, trial: null },
    ]);
    await expect(commerce.purchasePremiumPlan("test-user", offering, "monthly")).resolves.toEqual({
      status: "purchased",
      entitlement: { isPremium: false, hasActiveSubscription: false },
    });
    await expect(commerce.restorePremiumPurchases("test-user")).resolves.toEqual({
      isPremium: false,
      hasActiveSubscription: false,
    });
    expect(nativePromise).toHaveBeenCalledWith(
      "Purchases",
      "purchasePackage",
      expect.objectContaining({ aPackage: expect.anything() }),
    );
    expect(nativePromise).toHaveBeenCalledWith("Purchases", "restorePurchases", undefined);
  });
}
