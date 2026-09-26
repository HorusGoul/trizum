import { useEffect, useRef, useState } from "react";
import { useAppSession } from "#src/lib/auth-client.ts";
import { AdEntitlementContext } from "#src/lib/advertising/AdEntitlementContext.tsx";
import { getLogger } from "#src/lib/log.ts";
import type { PremiumEntitlementState } from "#src/lib/premium/premiumCommerce.ts";
import { PremiumContextProvider } from "#src/lib/premium/PremiumContext.ts";
import { getPremiumAccess } from "#src/lib/premium/premiumAccess.ts";
import { connectRevenueCatPremium } from "#src/lib/premium/revenueCatPremiumConnection.ts";
import {
  addRevenueCatCustomerInfoListener,
  clearRevenueCatUser,
  prepareRevenueCatUser,
  presentRevenueCatCustomerCenter,
  refreshRevenueCatCustomerInfo,
  removeRevenueCatCustomerInfoListener,
} from "#src/lib/premium/revenueCatClient.ts";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { PremiumPaywall } from "./PremiumPaywall.tsx";
import { getCurrentPremiumState, type ResolvedPremiumState } from "./premiumProviderState.ts";

interface PaywallRequest {
  promise: Promise<void>;
  resolve: () => void;
}

const logger = getLogger("components", "PremiumProvider");

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const session = useAppSession();
  const userId = session.data?.user.id ?? null;
  const hasSessionError = Boolean(session.error);
  const platform = getRevenueCatPlatform();
  const [resolvedState, setResolvedState] = useState<ResolvedPremiumState | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallSessionId, setPaywallSessionId] = useState(0);
  const paywallRequestRef = useRef<PaywallRequest | null>(null);
  const state = getCurrentPremiumState({
    hasSessionError,
    isSessionPending: session.isPending,
    platform,
    resolvedState,
    userId,
  });

  useEffect(() => {
    if (!platform || session.isPending || hasSessionError) {
      return;
    }

    if (!userId) {
      void clearRevenueCatUser().catch((error) => {
        logger.error("Failed to clear RevenueCat user", { error });
      });
      return;
    }

    const identifiedUserId = userId;
    function updateFromCustomerInfo(customerInfo: Parameters<typeof getPremiumAccess>[0]) {
      const access = getPremiumAccess(customerInfo);
      setResolvedState({
        hasActiveSubscription: access.hasActiveSubscription,
        status: access.isPremium ? "premium" : "free",
        userId: identifiedUserId,
      });
    }

    const connection = connectRevenueCatPremium({
      addListener: addRevenueCatCustomerInfoListener,
      onCustomerInfo: updateFromCustomerInfo,
      onListenerError(error) {
        logger.error("Failed to listen for Premium status", { error });
      },
      onRefreshError(error) {
        logger.error("Failed to resolve Premium status", { error });
        setResolvedState({
          hasActiveSubscription: false,
          status: "error",
          userId: identifiedUserId,
        });
      },
      prepare: () => prepareRevenueCatUser(identifiedUserId),
      refresh: refreshRevenueCatCustomerInfo,
      removeListener: removeRevenueCatCustomerInfoListener,
    });

    window.addEventListener("online", connection.reconnect);

    return () => {
      window.removeEventListener("online", connection.reconnect);
      connection.disconnect();
    };
  }, [hasSessionError, platform, session.isPending, userId]);

  const isPremium = state.status === "premium";
  const adEntitlement = state.status === "free" ? "adSupported" : isPremium ? "adFree" : "unknown";

  function updatePremiumEntitlement(entitlement: PremiumEntitlementState) {
    if (!userId) {
      return;
    }

    setResolvedState({
      hasActiveSubscription: entitlement.hasActiveSubscription,
      status: entitlement.isPremium ? "premium" : "free",
      userId,
    });
  }

  async function presentPaywall() {
    if (!userId) {
      throw new Error("A signed-in trizum account is required to purchase Premium.");
    }

    if (paywallRequestRef.current) {
      return paywallRequestRef.current.promise;
    }

    let resolveRequest: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    paywallRequestRef.current = { promise, resolve: resolveRequest };
    setPaywallSessionId((sessionId) => sessionId + 1);
    setIsPaywallOpen(true);
    return promise;
  }

  function setPaywallOpen(open: boolean) {
    setIsPaywallOpen(open);
    if (!open) {
      paywallRequestRef.current?.resolve();
      paywallRequestRef.current = null;
    }
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
      <AdEntitlementContext value={adEntitlement}>
        {children}
        <PremiumPaywall
          isOpen={isPaywallOpen}
          onEntitlementChange={updatePremiumEntitlement}
          onOpenChange={setPaywallOpen}
          sessionId={paywallSessionId}
          userId={userId}
        />
      </AdEntitlementContext>
    </PremiumContextProvider>
  );
}
