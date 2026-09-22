const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const PREMIUM_ENTITLEMENT_ID = "premium";

export interface PremiumVerification {
  expiresAt: number | null;
  isPremium: boolean;
}

export class PremiumVerificationUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PremiumVerificationUnavailableError";
  }
}

export async function verifyRevenueCatPremium({
  apiKey,
  fetcher = fetch,
  now = Date.now(),
  userId,
}: {
  apiKey: string | undefined;
  fetcher?: typeof fetch;
  now?: number;
  userId: string;
}): Promise<PremiumVerification> {
  if (!apiKey?.trim()) {
    throw new PremiumVerificationUnavailableError("REVENUECAT_SECRET_API_KEY is not configured.");
  }

  let response: Response;

  try {
    response = await fetcher(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(userId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch (error) {
    throw new PremiumVerificationUnavailableError("RevenueCat could not be reached.", {
      cause: error,
    });
  }

  if (response.status === 404) {
    return { expiresAt: null, isPremium: false };
  }

  if (!response.ok) {
    throw new PremiumVerificationUnavailableError(
      `RevenueCat returned an unexpected ${response.status} response.`,
    );
  }

  const payload = await response.json().catch((error) => {
    throw new PremiumVerificationUnavailableError("RevenueCat returned invalid JSON.", {
      cause: error,
    });
  });
  const entitlement = getPremiumEntitlement(payload);

  if (!entitlement) {
    return { expiresAt: null, isPremium: false };
  }

  if (entitlement.expires_date === null) {
    return { expiresAt: null, isPremium: true };
  }

  if (typeof entitlement.expires_date !== "string") {
    throw new PremiumVerificationUnavailableError(
      "RevenueCat returned an invalid Premium entitlement.",
    );
  }

  const expiresAt = Date.parse(entitlement.expires_date);

  if (!Number.isFinite(expiresAt)) {
    throw new PremiumVerificationUnavailableError(
      "RevenueCat returned an invalid Premium expiration date.",
    );
  }

  return {
    expiresAt,
    isPremium: expiresAt > now,
  };
}

function getPremiumEntitlement(payload: unknown): { expires_date: unknown } | null {
  if (!payload || typeof payload !== "object") {
    throw new PremiumVerificationUnavailableError("RevenueCat returned an invalid subscriber.");
  }

  const subscriber = (payload as { subscriber?: unknown }).subscriber;

  if (!subscriber || typeof subscriber !== "object") {
    throw new PremiumVerificationUnavailableError("RevenueCat returned an invalid subscriber.");
  }

  const entitlements = (subscriber as { entitlements?: unknown }).entitlements;

  if (!entitlements || typeof entitlements !== "object") {
    return null;
  }

  const entitlement = (entitlements as Record<string, unknown>)[PREMIUM_ENTITLEMENT_ID];

  if (entitlement === undefined) {
    return null;
  }

  if (!entitlement || typeof entitlement !== "object" || !("expires_date" in entitlement)) {
    throw new PremiumVerificationUnavailableError(
      "RevenueCat returned an invalid Premium entitlement.",
    );
  }

  return entitlement as { expires_date: unknown };
}
