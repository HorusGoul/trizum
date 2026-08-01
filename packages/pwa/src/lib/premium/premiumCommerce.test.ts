import type {
  IntroEligibility,
  PurchasesOffering,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { describe, expect, it } from "vite-plus/test";
import { createPremiumOffering } from "./premiumCommerce.ts";

const eligibleStatus = 2 as IntroEligibility["status"];

describe("createPremiumOffering", () => {
  it("uses the annual package as the default and preserves store-localized prices", () => {
    const offering = createOffering({
      annual: createPackage({
        identifier: "premium-annual",
        price: "€29.99",
        pricePerMonth: "€2.50",
        trialDays: 7,
      }),
      lifetime: createPackage({
        identifier: "premium-lifetime",
        price: "€79.99",
      }),
      monthly: createPackage({
        identifier: "premium-monthly",
        price: "€3.99",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {
        "premium-annual": {
          description: "Eligible for introductory offer",
          status: eligibleStatus,
        },
      },
      offering,
    });

    expect(result).toEqual({
      defaultPlanId: "annual",
      plans: [
        {
          id: "monthly",
          price: "€3.99",
          pricePerMonth: null,
          trial: null,
        },
        {
          id: "annual",
          price: "€29.99",
          pricePerMonth: "€2.50",
          trial: { duration: 7, unit: "day" },
        },
        {
          id: "lifetime",
          price: "€79.99",
          pricePerMonth: null,
          trial: null,
        },
      ],
    });
  });

  it("does not advertise a trial unless the store confirms eligibility", () => {
    const offering = createOffering({
      annual: createPackage({
        identifier: "premium-annual",
        price: "$29.99",
        pricePerMonth: "$2.50",
        trialDays: 7,
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {
        "premium-annual": {
          description: "Eligibility unknown",
          status: 0 as IntroEligibility["status"],
        },
      },
      offering,
      trialFallbacks: {
        annual: { duration: 1, unit: "week" },
      },
    });

    expect(result.plans[0]?.trial).toBeNull();
  });

  it("uses the eligible free phase selected by Google Play's default option", () => {
    const offering = createOffering({
      annual: createPackage({
        googleTrial: {
          billingCycleCount: 1,
          duration: 1,
          unit: "WEEK",
        },
        identifier: "premium-annual",
        price: "$29.99",
        pricePerMonth: "$2.50",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {},
      offering,
    });

    expect(result.plans[0]?.trial).toEqual({ duration: 1, unit: "week" });
  });

  it("does not advertise a Google Play trial that is not the default purchase option", () => {
    const offering = createOffering({
      annual: createPackage({
        googleTrial: {
          duration: 1,
          isDefault: false,
          unit: "WEEK",
        },
        identifier: "premium-annual",
        price: "$29.99",
        pricePerMonth: "$2.50",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {},
      offering,
    });

    expect(result.plans[0]?.trial).toBeNull();
  });

  it("includes every Google Play free billing cycle in the displayed trial duration", () => {
    const offering = createOffering({
      annual: createPackage({
        googleTrial: {
          billingCycleCount: 3,
          duration: 1,
          unit: "MONTH",
        },
        identifier: "premium-annual",
        price: "$29.99",
        pricePerMonth: "$2.50",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {},
      offering,
    });

    expect(result.plans[0]?.trial).toEqual({ duration: 3, unit: "month" });
  });

  it("uses an explicit trial fallback for stores without introductory offer metadata", () => {
    const offering = createOffering({
      annual: createPackage({
        identifier: "premium-annual",
        price: "$29.99",
        pricePerMonth: "$2.50",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {},
      offering,
      trialFallbacks: {
        annual: { duration: 1, unit: "week" },
      },
    });

    expect(result.plans[0]?.trial).toEqual({ duration: 1, unit: "week" });
  });

  it("falls back to the first available supported package", () => {
    const offering = createOffering({
      lifetime: createPackage({
        identifier: "premium-lifetime",
        price: "$79.99",
      }),
      monthly: createPackage({
        identifier: "premium-monthly",
        price: "$3.99",
      }),
    });

    const result = createPremiumOffering({
      eligibleStatus,
      eligibilityByProductId: {},
      offering,
    });

    expect(result.defaultPlanId).toBe("monthly");
    expect(result.plans.map(({ id }) => id)).toEqual(["monthly", "lifetime"]);
  });
});

function createOffering({
  annual = null,
  lifetime = null,
  monthly = null,
}: {
  annual?: PurchasesPackage | null;
  lifetime?: PurchasesPackage | null;
  monthly?: PurchasesPackage | null;
}) {
  return {
    annual,
    lifetime,
    monthly,
  } as unknown as PurchasesOffering;
}

function createPackage({
  googleTrial,
  identifier,
  price,
  pricePerMonth = null,
  trialDays,
}: {
  googleTrial?: {
    billingCycleCount?: number | null;
    duration: number;
    isDefault?: boolean;
    unit: "DAY" | "MONTH" | "WEEK" | "YEAR";
  };
  identifier: string;
  price: string;
  pricePerMonth?: string | null;
  trialDays?: number;
}) {
  const googleTrialOption = googleTrial
    ? {
        freePhase: {
          billingCycleCount: googleTrial.billingCycleCount ?? null,
          billingPeriod: {
            unit: googleTrial.unit,
            value: googleTrial.duration,
          },
        },
      }
    : null;

  return {
    product: {
      defaultOption: googleTrial?.isDefault === false ? null : googleTrialOption,
      identifier,
      introPrice: trialDays
        ? {
            periodNumberOfUnits: trialDays,
            periodUnit: "DAY",
            price: 0,
          }
        : null,
      pricePerMonthString: pricePerMonth,
      priceString: price,
      subscriptionOptions: googleTrialOption ? [googleTrialOption] : null,
    },
  } as PurchasesPackage;
}
