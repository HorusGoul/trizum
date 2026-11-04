import {
  createCustomerInfo,
  createOffering,
  createPurchasesPackage,
  createStoreProduct,
} from "./revenueCatTestFixtures.ts";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesPlugin,
} from "@revenuecat/purchases-capacitor";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPremiumCommerce } from "./premiumCommerce.ts";

const revenueCat = vi.hoisted(() => ({
  getOfferings:
    vi.fn<
      () => Promise<{ current: PurchasesOffering | null; all: Record<string, PurchasesOffering> }>
    >(),
  purchasePackage: vi.fn<
    (options: { aPackage: PurchasesPackage }) => Promise<{
      customerInfo: CustomerInfo;
      productIdentifier: string;
      transaction: {
        transactionIdentifier: string;
        productIdentifier: string;
        purchaseDate: string;
        purchaseToken: string | null;
        originalJson: string | null;
        signature: string | null;
      };
    }>
  >(),
}));

const identity = vi.hoisted(() => ({
  synchronizeUser: vi.fn<(userId: string) => Promise<void>>(),
}));

const { loadPremiumOffering, purchasePremiumPlan } = createPremiumCommerce({
  getStore: async () => ({
    ...revenueCat,
    restorePurchases: vi.fn<PurchasesPlugin["restorePurchases"]>(),
    checkTrialOrIntroductoryPriceEligibility:
      vi.fn<PurchasesPlugin["checkTrialOrIntroductoryPriceEligibility"]>(),
  }),
  synchronizeUser: identity.synchronizeUser,
  getPlatform: () => undefined,
  isTestStoreEnabled: () => false,
});

describe("Premium offering purchase binding", () => {
  beforeEach(() => {
    revenueCat.getOfferings.mockReset();
    revenueCat.purchasePackage.mockReset().mockResolvedValue({
      customerInfo: createCustomerInfo(),
      productIdentifier: "premium-monthly",
      transaction: {
        transactionIdentifier: "transaction",
        productIdentifier: "premium-monthly",
        purchaseDate: "2026-01-01",
        purchaseToken: null,
        originalJson: null,
        signature: null,
      },
    });
    identity.synchronizeUser.mockReset().mockResolvedValue(undefined);
  });

  it("purchases the displayed package when an older load resolves last", async () => {
    const olderPackage = createPackage("older-package", "$3.99");
    const displayedPackage = createPackage("displayed-package", "$4.99");

    const olderResponse = createDeferred<{
      current: PurchasesOffering;
      all: Record<string, PurchasesOffering>;
    }>();

    const displayedResponse = createDeferred<{
      current: PurchasesOffering;
      all: Record<string, PurchasesOffering>;
    }>();

    revenueCat.getOfferings
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(displayedResponse.promise);

    const olderLoad = loadPremiumOffering("user-1");
    await waitForOfferingRequest(1);
    const displayedLoad = loadPremiumOffering("user-1");
    await waitForOfferingRequest(2);

    displayedResponse.resolve({ current: createOffering({ monthly: displayedPackage }), all: {} });
    const displayedOffering = await displayedLoad;
    olderResponse.resolve({ current: createOffering({ monthly: olderPackage }), all: {} });
    await olderLoad;

    await purchasePremiumPlan("user-1", displayedOffering, "monthly");

    expect(revenueCat.purchasePackage).toHaveBeenCalledWith({ aPackage: displayedPackage });
  });
});

async function waitForOfferingRequest(count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (revenueCat.getOfferings.mock.calls.length >= count) {
      return;
    }

    await Promise.resolve();
  }

  throw new Error(`RevenueCat offering request ${count} did not start.`);
}

function createPackage(identifier: string, priceString: string) {
  return createPurchasesPackage({
    identifier,
    product: createStoreProduct({ identifier, priceString }),
  });
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
