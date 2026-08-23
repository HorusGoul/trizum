import type { CustomerInfo, PurchasesEntitlementInfo } from "@revenuecat/purchases-capacitor";

export const PREMIUM_ENTITLEMENT_IDENTIFIER = "premium";

export interface PremiumAccess {
  entitlement: PurchasesEntitlementInfo | undefined;
  hasActiveSubscription: boolean;
  isPremium: boolean;
}

export function getPremiumAccess(customerInfo: CustomerInfo): PremiumAccess {
  const entitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_IDENTIFIER];
  const isPremium = Boolean(entitlement && entitlement.ownershipType !== "FAMILY_SHARED");

  return {
    entitlement: isPremium ? entitlement : undefined,
    hasActiveSubscription: Boolean(
      isPremium &&
      entitlement &&
      customerInfo.activeSubscriptions.includes(entitlement.productIdentifier),
    ),
    isPremium,
  };
}
