import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "@revenuecat/purchases-capacitor";
import { vi } from "vite-plus/test";
import { PACKAGE_TYPE, PRODUCT_TYPE, VERIFICATION_RESULT } from "@revenuecat/purchases-capacitor";
import type { RevenueCatStore } from "./revenueCatClient.ts";

export function createRevenueCatStore() {
  return {
    configure: vi.fn<RevenueCatStore["configure"]>().mockResolvedValue(undefined),
    setLogLevel: vi.fn<RevenueCatStore["setLogLevel"]>().mockResolvedValue(undefined),
    getCustomerInfo: vi
      .fn<RevenueCatStore["getCustomerInfo"]>()
      .mockResolvedValue({ customerInfo: createCustomerInfo() }),
    logIn: vi
      .fn<RevenueCatStore["logIn"]>()
      .mockResolvedValue({ customerInfo: createCustomerInfo(), created: false }),
    logOut: vi
      .fn<RevenueCatStore["logOut"]>()
      .mockResolvedValue({ customerInfo: createCustomerInfo() }),
    syncPurchases: vi.fn<RevenueCatStore["syncPurchases"]>().mockResolvedValue(undefined),
    invalidateCustomerInfoCache: vi
      .fn<RevenueCatStore["invalidateCustomerInfoCache"]>()
      .mockResolvedValue(undefined),
    presentCodeRedemptionSheet: vi
      .fn<RevenueCatStore["presentCodeRedemptionSheet"]>()
      .mockResolvedValue(undefined),
    addCustomerInfoUpdateListener: vi
      .fn<RevenueCatStore["addCustomerInfoUpdateListener"]>()
      .mockResolvedValue("listener"),
    removeCustomerInfoUpdateListener: vi
      .fn<RevenueCatStore["removeCustomerInfoUpdateListener"]>()
      .mockResolvedValue({ wasRemoved: true }),
  } satisfies RevenueCatStore;
}

const purchaseDate = "2026-01-01T00:00:00.000Z";

export function createCustomerInfo(overrides: Partial<CustomerInfo> = {}): CustomerInfo {
  return {
    entitlements: { active: {}, all: {}, verification: VERIFICATION_RESULT.NOT_REQUESTED },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: purchaseDate,
    originalAppUserId: "test-user",
    requestDate: purchaseDate,
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    ...overrides,
  };
}

export function createEntitlement(
  overrides: Partial<PurchasesEntitlementInfo> = {},
): PurchasesEntitlementInfo {
  return {
    identifier: "premium",
    isActive: true,
    willRenew: false,
    periodType: "NORMAL",
    latestPurchaseDate: purchaseDate,
    latestPurchaseDateMillis: Date.parse(purchaseDate),
    originalPurchaseDate: purchaseDate,
    originalPurchaseDateMillis: Date.parse(purchaseDate),
    expirationDate: null,
    expirationDateMillis: null,
    store: "APP_STORE",
    productIdentifier: "premium-monthly",
    productPlanIdentifier: null,
    isSandbox: false,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: null,
    billingIssueDetectedAtMillis: null,
    ownershipType: "PURCHASED",
    verification: VERIFICATION_RESULT.NOT_REQUESTED,
    ...overrides,
  };
}

export function createStoreProduct(
  overrides: Partial<PurchasesStoreProduct> = {},
): PurchasesStoreProduct {
  return {
    identifier: "premium-monthly",
    description: "Test Premium product",
    title: "Premium",
    price: 4.99,
    priceString: "$4.99",
    pricePerWeek: null,
    pricePerMonth: null,
    pricePerYear: null,
    pricePerWeekString: null,
    pricePerMonthString: null,
    pricePerYearString: null,
    currencyCode: "USD",
    introPrice: null,
    discounts: null,
    productCategory: null,
    productType: PRODUCT_TYPE.UNKNOWN,
    subscriptionPeriod: null,
    defaultOption: null,
    subscriptionOptions: null,
    presentedOfferingIdentifier: null,
    presentedOfferingContext: null,
    installmentsInfo: null,
    ...overrides,
  };
}

export function createPurchasesPackage(
  overrides: Partial<PurchasesPackage> = {},
): PurchasesPackage {
  return {
    identifier: "premium-monthly",
    packageType: PACKAGE_TYPE.CUSTOM,
    product: createStoreProduct(),
    offeringIdentifier: "test-offering",
    presentedOfferingContext: {
      offeringIdentifier: "test-offering",
      placementIdentifier: null,
      targetingContext: null,
    },
    webCheckoutUrl: null,
    ...overrides,
  };
}

export function createOffering(overrides: Partial<PurchasesOffering> = {}): PurchasesOffering {
  const availablePackages = [overrides.monthly, overrides.annual, overrides.lifetime].filter(
    (aPackage): aPackage is PurchasesPackage => aPackage != null,
  );

  return {
    identifier: "test-offering",
    serverDescription: "Test offering",
    metadata: {},
    availablePackages,
    lifetime: null,
    annual: null,
    sixMonth: null,
    threeMonth: null,
    twoMonth: null,
    monthly: null,
    weekly: null,
    webCheckoutUrl: null,
    ...overrides,
  };
}
