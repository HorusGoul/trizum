import type { PremiumStatus } from "#src/lib/premium/PremiumContext.ts";
import type { RevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";

interface PremiumState {
  hasActiveSubscription: boolean;
  status: PremiumStatus;
}

export interface ResolvedPremiumState extends PremiumState {
  userId: string;
}

export function getCurrentPremiumState({
  hasSessionError,
  isSessionPending,
  platform,
  resolvedState,
  userId,
}: {
  hasSessionError?: boolean;
  isSessionPending: boolean;
  platform: RevenueCatPlatform | undefined;
  resolvedState: ResolvedPremiumState | null;
  userId: string | null;
}): PremiumState {
  if (!platform) {
    return { hasActiveSubscription: false, status: "unavailable" };
  }

  if (isSessionPending) {
    return { hasActiveSubscription: false, status: "loading" };
  }

  if (hasSessionError) {
    return { hasActiveSubscription: false, status: "error" };
  }

  if (!userId) {
    return { hasActiveSubscription: false, status: "free" };
  }

  if (resolvedState?.userId !== userId) {
    return { hasActiveSubscription: false, status: "loading" };
  }

  return resolvedState;
}
