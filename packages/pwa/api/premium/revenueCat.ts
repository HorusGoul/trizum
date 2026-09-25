import { createRevenueCatApiClient } from "@trizum/revenuecat-api";

const PREMIUM_ENTITLEMENT_ID = "premium";

export interface PremiumVerification {
  isPremium: boolean;
}

export class PremiumVerificationUnavailableError extends Error {
  override readonly name = "PremiumVerificationUnavailableError";
}

export async function verifyRevenueCatPremium({
  apiKey,
  fetcher,
  projectId,
  userId,
}: {
  apiKey: string | undefined;
  fetcher?: typeof fetch;
  projectId: string | undefined;
  userId: string;
}): Promise<PremiumVerification> {
  if (!apiKey?.trim()) {
    throw new PremiumVerificationUnavailableError("REVENUECAT_SECRET_API_KEY is not configured.");
  }

  if (!projectId?.trim()) {
    throw new PremiumVerificationUnavailableError("REVENUECAT_PROJECT_ID is not configured.");
  }

  try {
    const client = createRevenueCatApiClient({
      ...(fetcher ? { fetcher } : {}),
      secretApiKey: apiKey,
    });
    const isPremium = await client.hasDirectEntitlement({
      customerId: userId,
      entitlementLookupKey: PREMIUM_ENTITLEMENT_ID,
      environment: "production",
      projectId,
    });

    return { isPremium };
  } catch (error) {
    throw new PremiumVerificationUnavailableError("RevenueCat Premium verification failed.", {
      cause: error,
    });
  }
}
