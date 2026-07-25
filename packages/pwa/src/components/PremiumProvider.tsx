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

const logger = getLogger("components", "PremiumProvider");

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const userId = session.data?.user.id ?? null;
  const [state, setState] = useState<PremiumState>(() => ({
    hasActiveSubscription: false,
    status: getRevenueCatPlatform() ? "loading" : "unavailable",
  }));

  useEffect(() => {
    if (!getRevenueCatPlatform() || session.isPending) {
      return;
    }

    let active = true;
    let listenerId: string | undefined;

    if (!userId) {
      setState({ hasActiveSubscription: false, status: "free" });
      void clearRevenueCatUser().catch((error) => {
        logger.error("Failed to clear RevenueCat user", { error });
      });
      return;
    }

    setState({ hasActiveSubscription: false, status: "loading" });

    function updateFromCustomerInfo(customerInfo: Parameters<typeof getPremiumAccess>[0]) {
      if (!active) {
        return;
      }

      const access = getPremiumAccess(customerInfo);
      setState({
        hasActiveSubscription: access.hasActiveSubscription,
        status: access.isPremium ? "premium" : "free",
      });
    }

    void synchronizeRevenueCatUser(userId)
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
          setState({ hasActiveSubscription: false, status: "error" });
        }
      });

    return () => {
      active = false;
      if (listenerId) {
        void removeRevenueCatCustomerInfoListener(listenerId);
      }
    };
  }, [session.isPending, userId]);

  const isPremium = state.status === "premium";
  const adEntitlement = state.status === "free" ? "adSupported" : isPremium ? "adFree" : "unknown";

  async function presentPaywall() {
    await presentRevenueCatPaywall(userId);
    const customerInfo = await refreshRevenueCatCustomerInfo();
    const access = getPremiumAccess(customerInfo);
    setState({
      hasActiveSubscription: access.hasActiveSubscription,
      status: access.isPremium ? "premium" : "free",
    });
  }

  async function presentCustomerCenter() {
    await presentRevenueCatCustomerCenter(userId);
    const customerInfo = await refreshRevenueCatCustomerInfo();
    const access = getPremiumAccess(customerInfo);
    setState({
      hasActiveSubscription: access.hasActiveSubscription,
      status: access.isPremium ? "premium" : "free",
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
