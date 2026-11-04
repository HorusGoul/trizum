import {
  createCustomerInfo as createCustomerInfoFixture,
  createEntitlement,
} from "./revenueCatTestFixtures.ts";
import { describe, expect, it } from "vite-plus/test";
import type { CustomerInfo, PurchasesEntitlementInfo } from "@revenuecat/purchases-capacitor";
import { getPremiumAccess, PREMIUM_ENTITLEMENT_IDENTIFIER } from "./premiumAccess.ts";

describe("getPremiumAccess", () => {
  it("recognizes an active subscription", () => {
    const customerInfo = createCustomerInfo({
      entitlement: createEntitlement({
        ownershipType: "PURCHASED",
        productIdentifier: "premium-monthly",
      }),
      activeSubscriptions: ["premium-monthly"],
    });

    expect(getPremiumAccess(customerInfo)).toMatchObject({
      hasActiveSubscription: true,
      isPremium: true,
    });
  });

  it("recognizes lifetime access without treating it as a subscription", () => {
    const customerInfo = createCustomerInfo({
      entitlement: createEntitlement({
        ownershipType: "PURCHASED",
        productIdentifier: "premium-lifetime",
      }),
    });

    expect(getPremiumAccess(customerInfo)).toMatchObject({
      hasActiveSubscription: false,
      isPremium: true,
    });
  });

  it("does not grant store-level family-shared access", () => {
    const customerInfo = createCustomerInfo({
      entitlement: createEntitlement({
        ownershipType: "FAMILY_SHARED",
        productIdentifier: "premium-annual",
      }),
      activeSubscriptions: ["premium-annual"],
    });

    expect(getPremiumAccess(customerInfo)).toEqual({
      entitlement: undefined,
      hasActiveSubscription: false,
      isPremium: false,
    });
  });
});

function createCustomerInfo({
  activeSubscriptions = [],
  entitlement,
}: {
  activeSubscriptions?: string[];
  entitlement?: PurchasesEntitlementInfo;
}) {
  const customerInfo = createCustomerInfoFixture({ activeSubscriptions });

  const active: CustomerInfo["entitlements"]["active"] = entitlement
    ? { [PREMIUM_ENTITLEMENT_IDENTIFIER]: entitlement }
    : {};

  return {
    ...customerInfo,
    entitlements: { ...customerInfo.entitlements, active, all: active },
  };
}
