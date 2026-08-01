import type {
  CustomerInfo,
  IntroEligibility,
  PurchasesOffering,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { getPremiumAccess } from "./premiumAccess.ts";
import { getRevenueCatPlatform, isRevenueCatTestStoreEnabled } from "./revenueCatConfig.ts";
import { PremiumSignInRequiredError, synchronizeRevenueCatUser } from "./revenueCatClient.ts";

export type PremiumPlanId = "annual" | "lifetime" | "monthly";

export interface PremiumTrial {
  duration: number;
  unit: "day" | "month" | "week" | "year";
}

export interface PremiumPlan {
  id: PremiumPlanId;
  price: string;
  pricePerMonth: string | null;
  trial: PremiumTrial | null;
}

export interface PremiumOffering {
  defaultPlanId: PremiumPlanId;
  plans: PremiumPlan[];
}

export interface PremiumEntitlementState {
  hasActiveSubscription: boolean;
  isPremium: boolean;
}

export type PremiumPurchaseResult =
  | {
      entitlement: PremiumEntitlementState;
      status: "purchased";
    }
  | {
      status: "cancelled";
    };

interface CachedOffering {
  packages: Map<PremiumPlanId, PurchasesPackage>;
  userId: string;
}

const TEST_STORE_TRIAL_FALLBACKS = {
  annual: { duration: 1, unit: "week" },
} satisfies Partial<Record<PremiumPlanId, PremiumTrial>>;

let cachedOffering: CachedOffering | null = null;

export async function loadPremiumOffering(userId: string | null): Promise<PremiumOffering> {
  requireUserId(userId);
  await synchronizeRevenueCatUser(userId);

  const { INTRO_ELIGIBILITY_STATUS, Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;

  if (!offering) {
    throw new Error("RevenueCat did not return a current Premium offering.");
  }

  const packages = getPremiumPackages(offering);
  if (packages.size === 0) {
    throw new Error("The current RevenueCat offering has no supported Premium packages.");
  }

  let eligibilityByProductId: Record<string, IntroEligibility> = {};
  if (getRevenueCatPlatform() === "ios") {
    const productIdentifiers: string[] = [];
    for (const { product } of packages.values()) {
      if (product.introPrice?.price === 0) {
        productIdentifiers.push(product.identifier);
      }
    }

    if (productIdentifiers.length > 0) {
      try {
        eligibilityByProductId = await Purchases.checkTrialOrIntroductoryPriceEligibility({
          productIdentifiers,
        });
      } catch {
        // Eligibility is optional presentation data. StoreKit still applies valid offers at checkout.
      }
    }
  }

  cachedOffering = { packages, userId };

  return createPremiumOffering({
    eligibleStatus: INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
    eligibilityByProductId,
    offering,
    trialFallbacks: isRevenueCatTestStoreEnabled() ? TEST_STORE_TRIAL_FALLBACKS : undefined,
  });
}

export async function purchasePremiumPlan(
  userId: string | null,
  planId: PremiumPlanId,
): Promise<PremiumPurchaseResult> {
  requireUserId(userId);
  await synchronizeRevenueCatUser(userId);

  if (cachedOffering?.userId !== userId || !cachedOffering.packages.has(planId)) {
    await loadPremiumOffering(userId);
  }

  const selectedPackage = cachedOffering?.packages.get(planId);
  if (!selectedPackage) {
    throw new Error(`Premium package "${planId}" is not available.`);
  }

  const { PURCHASES_ERROR_CODE, Purchases } = await import("@revenuecat/purchases-capacitor");

  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: selectedPackage });
    return {
      entitlement: getPremiumEntitlementState(customerInfo),
      status: "purchased",
    };
  } catch (error) {
    if (isPurchaseCancellation(error, PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)) {
      return { status: "cancelled" };
    }

    throw error;
  }
}

export async function restorePremiumPurchases(
  userId: string | null,
): Promise<PremiumEntitlementState> {
  requireUserId(userId);
  await synchronizeRevenueCatUser(userId);

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.restorePurchases();
  return getPremiumEntitlementState(customerInfo);
}

export function createPremiumOffering({
  eligibleStatus,
  eligibilityByProductId,
  offering,
  trialFallbacks,
}: {
  eligibleStatus: IntroEligibility["status"];
  eligibilityByProductId: Record<string, IntroEligibility>;
  offering: PurchasesOffering;
  trialFallbacks?: Partial<Record<PremiumPlanId, PremiumTrial>>;
}): PremiumOffering {
  const packages = getPremiumPackages(offering);
  const plans = (["monthly", "annual", "lifetime"] as const).flatMap((planId) => {
    const premiumPackage = packages.get(planId);
    if (!premiumPackage) {
      return [];
    }

    const { product } = premiumPackage;
    const introPrice = product.introPrice;
    const eligibility = eligibilityByProductId[product.identifier];
    const introUnit = getTrialUnit(introPrice?.periodUnit);
    const eligibleAppleTrial =
      introPrice?.price === 0 && eligibility?.status === eligibleStatus && introUnit
        ? {
            duration: introPrice.periodNumberOfUnits,
            unit: introUnit,
          }
        : null;
    const eligibleGoogleTrial = getGoogleDefaultOptionTrial(product.defaultOption);
    const trial =
      eligibleGoogleTrial ?? (introPrice ? eligibleAppleTrial : (trialFallbacks?.[planId] ?? null));

    return [
      {
        id: planId,
        price: product.priceString,
        pricePerMonth: planId === "annual" ? product.pricePerMonthString : null,
        trial,
      },
    ];
  });

  return {
    defaultPlanId: plans.some(({ id }) => id === "annual") ? "annual" : plans[0]!.id,
    plans,
  };
}

function getPremiumPackages(offering: PurchasesOffering) {
  const packages = new Map<PremiumPlanId, PurchasesPackage>();
  if (offering.monthly) {
    packages.set("monthly", offering.monthly);
  }
  if (offering.annual) {
    packages.set("annual", offering.annual);
  }
  if (offering.lifetime) {
    packages.set("lifetime", offering.lifetime);
  }
  return packages;
}

function getPremiumEntitlementState(customerInfo: CustomerInfo): PremiumEntitlementState {
  const access = getPremiumAccess(customerInfo);
  return {
    hasActiveSubscription: access.hasActiveSubscription,
    isPremium: access.isPremium,
  };
}

function getTrialUnit(unit: string | undefined): PremiumTrial["unit"] | undefined {
  switch (unit?.toLowerCase()) {
    case "day":
      return "day";
    case "week":
      return "week";
    case "month":
      return "month";
    case "year":
      return "year";
    default:
      return;
  }
}

function getGoogleDefaultOptionTrial(
  defaultOption: PurchasesPackage["product"]["defaultOption"],
): PremiumTrial | null {
  const freePhase = defaultOption?.freePhase;
  const unit = getTrialUnit(freePhase?.billingPeriod.unit);
  if (!freePhase || !unit) {
    return null;
  }

  const billingCycleCount = freePhase.billingCycleCount ?? 1;
  return {
    duration: freePhase.billingPeriod.value * billingCycleCount,
    unit,
  };
}

function isPurchaseCancellation(error: unknown, cancellationCode: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const purchaseError = error as { code?: unknown; userCancelled?: unknown };
  return purchaseError.userCancelled === true || purchaseError.code === cancellationCode;
}

function requireUserId(userId: string | null): asserts userId is string {
  if (!userId) {
    throw new PremiumSignInRequiredError();
  }
}
