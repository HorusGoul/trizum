import { useEffect, useState } from "react";
import { authClient } from "#src/lib/auth-client.ts";
import { AdEntitlementContext } from "#src/lib/advertising/AdEntitlementContext.tsx";
import { getLogger } from "#src/lib/log.ts";
import { PremiumContextProvider, type PremiumStatus } from "#src/lib/premium/PremiumContext.ts";
import { getPremiumAccess } from "#src/lib/premium/premiumAccess.ts";
import {
  addRevenueCatCustomerInfoListener,
  clearRevenueCatUser,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  refreshRevenueCatCustomerInfo,
  removeRevenueCatCustomerInfoListener,
  synchronizeRevenueCatUser,
} from "#src/lib/premium/revenueCatClient.ts";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";

interface PremiumState {
  hasActiveSubscription: boolean;
  status: PremiumStatus;
}

interface ResolvedPremiumState extends PremiumState {
  userId: string;
}

const logger = getLogger("components", "PremiumProvider");

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const userId = session.data?.user.id ?? null;
  const platform = getRevenueCatPlatform();
  const [resolvedState, setResolvedState] = useState<ResolvedPremiumState | null>(null);
  const state = getCurrentPremiumState({
    isSessionPending: session.isPending,
    platform,
    resolvedState,
    userId,
  });

  useEffect(() => {
    if (!platform || session.isPending) {
      return;
    }

    if (!userId) {
      void clearRevenueCatUser().catch((error) => {
        logger.error("Failed to clear RevenueCat user", { error });
      });
      return;
    }

    const identifiedUserId = userId;
    let active = true;
    let listenerId: string | undefined;

    function updateFromCustomerInfo(customerInfo: Parameters<typeof getPremiumAccess>[0]) {
      if (!active) {
        return;
      }

      const access = getPremiumAccess(customerInfo);
      setResolvedState({
        hasActiveSubscription: access.hasActiveSubscription,
        status: access.isPremium ? "premium" : "free",
        userId: identifiedUserId,
      });
    }

    void synchronizeRevenueCatUser(identifiedUserId)
      .then((customerInfo) => {
        if (customerInfo) {
          updateFromCustomerInfo(customerInfo);
        }

        return addRevenueCatCustomerInfoListener(updateFromCustomerInfo);
      })
      .then((registeredListenerId) => {
        if (active) {
          listenerId = registeredListenerId;
          return;
        }

        return removeRevenueCatCustomerInfoListener(registeredListenerId);
      })
      .catch((error) => {
        logger.error("Failed to resolve Premium status", { error });
        if (active) {
          setResolvedState({
            hasActiveSubscription: false,
            status: "error",
            userId: identifiedUserId,
          });
        }
      });

    return () => {
      active = false;
      if (listenerId) {
        void removeRevenueCatCustomerInfoListener(listenerId);
      }
    };
  }, [platform, session.isPending, userId]);

  const isPremium = state.status === "premium";
  const adEntitlement = state.status === "free" ? "adSupported" : isPremium ? "adFree" : "unknown";

  async function presentPaywall() {
    await presentRevenueCatPaywall(userId);
    const customerInfo = await refreshRevenueCatCustomerInfo();
    const access = getPremiumAccess(customerInfo);
    if (!userId) {
      return;
    }
    setResolvedState({
      hasActiveSubscription: access.hasActiveSubscription,
      status: access.isPremium ? "premium" : "free",
      userId,
    });
  }

  async function presentCustomerCenter() {
    await presentRevenueCatCustomerCenter(userId);
    const customerInfo = await refreshRevenueCatCustomerInfo();
    const access = getPremiumAccess(customerInfo);
    if (!userId) {
      return;
    }
    setResolvedState({
      hasActiveSubscription: access.hasActiveSubscription,
      status: access.isPremium ? "premium" : "free",
      userId,
    });
  }

  return (
    <PremiumContextProvider
      value={{
        hasActiveSubscription: state.hasActiveSubscription,
        isPremium,
        presentCustomerCenter,
        presentPaywall,
        status: state.status,
      }}
    >
      <AdEntitlementContext value={adEntitlement}>{children}</AdEntitlementContext>
    </PremiumContextProvider>
  );
}

function getCurrentPremiumState({
  isSessionPending,
  platform,
  resolvedState,
  userId,
}: {
  isSessionPending: boolean;
  platform: ReturnType<typeof getRevenueCatPlatform>;
  resolvedState: ResolvedPremiumState | null;
  userId: string | null;
}): PremiumState {
  if (!platform) {
    return { hasActiveSubscription: false, status: "unavailable" };
  }

  if (isSessionPending) {
    return { hasActiveSubscription: false, status: "loading" };
  }

  if (!userId) {
    return { hasActiveSubscription: false, status: "free" };
  }

  if (resolvedState?.userId !== userId) {
    return { hasActiveSubscription: false, status: "loading" };
  }

  return resolvedState;
}
