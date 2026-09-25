import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { loadPremiumOffering, purchasePremiumPlan } from "./premiumCommerce.ts";

const revenueCat = vi.hoisted(() => ({
  getOfferings: vi.fn<() => Promise<{ current: PurchasesOffering | null }>>(),
  purchasePackage:
    vi.fn<(options: { aPackage: PurchasesPackage }) => Promise<{ customerInfo: CustomerInfo }>>(),
}));
const identity = vi.hoisted(() => ({
  synchronizeUser: vi.fn<(userId: string) => Promise<void>>(),
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2 },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: "purchase_cancelled" },
  Purchases: revenueCat,
}));

vi.mock("./revenueCatClient.ts", () => ({
  PremiumSignInRequiredError: class PremiumSignInRequiredError extends Error {},
  synchronizeRevenueCatUser: identity.synchronizeUser,
}));

vi.mock("./revenueCatConfig.ts", () => ({
  getRevenueCatPlatform: () => undefined,
  isRevenueCatTestStoreEnabled: () => false,
}));

describe("Premium offering purchase binding", () => {
  beforeEach(() => {
    revenueCat.getOfferings.mockReset();
    revenueCat.purchasePackage.mockReset().mockResolvedValue({
      customerInfo: {
        activeSubscriptions: [],
        entitlements: { active: {} },
      } as unknown as CustomerInfo,
    });
    identity.synchronizeUser.mockReset().mockResolvedValue(undefined);
  });

  it("purchases the displayed package when an older load resolves last", async () => {
    const olderPackage = createPackage("older-package", "$3.99");
    const displayedPackage = createPackage("displayed-package", "$4.99");
    const olderResponse = createDeferred<{ current: PurchasesOffering }>();
    const displayedResponse = createDeferred<{ current: PurchasesOffering }>();
    revenueCat.getOfferings
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(displayedResponse.promise);

    const olderLoad = loadPremiumOffering("user-1");
    await waitForOfferingRequest(1);
    const displayedLoad = loadPremiumOffering("user-1");
    await waitForOfferingRequest(2);

    displayedResponse.resolve({ current: createOffering(displayedPackage) });
    const displayedOffering = await displayedLoad;
    olderResponse.resolve({ current: createOffering(olderPackage) });
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

function createOffering(monthly: PurchasesPackage) {
  return { annual: null, lifetime: null, monthly } as unknown as PurchasesOffering;
}

function createPackage(identifier: string, priceString: string) {
  return {
    identifier,
    product: {
      defaultOption: null,
      identifier,
      introPrice: null,
      pricePerMonthString: null,
      priceString,
    },
  } as unknown as PurchasesPackage;
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
