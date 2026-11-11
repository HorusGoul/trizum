import { useFateState } from "#src/lib/data/fateState.ts";
import { trackEvent } from "#src/lib/analytics.ts";
import { useEffect, useRef, useState, type ComponentType, type ComponentProps } from "react";
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
import {
  getCurrentPremiumState,
  getPremiumStateAfterRefreshError,
  type ResolvedPremiumState,
} from "./premiumProviderState.ts";

interface PaywallRequest {
  promise: Promise<PremiumEntitlementState | null>;
  resolve: (entitlement: PremiumEntitlementState | null) => void;
  entitlement: PremiumEntitlementState | null;
}

const logger = getLogger("components", "PremiumProvider");

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const session = useAppSession();

  return (
    <PremiumProviderState
      userId={session.data?.user.id ?? null}
      hasSessionError={Boolean(session.error)}
      isSessionPending={session.isPending}
      platform={getRevenueCatPlatform()}
    >
      {children}
    </PremiumProviderState>
  );
}

/** Composes session state with the store connection and the paywall presentation. */
export function PremiumProviderState({
  children,
  userId,
  hasSessionError,
  isSessionPending,
  platform,
  Paywall = PremiumPaywall,
}: {
  children: React.ReactNode;
  userId: string | null;
  hasSessionError: boolean;
  isSessionPending: boolean;
  platform: ReturnType<typeof getRevenueCatPlatform>;
  Paywall?: ComponentType<ComponentProps<typeof PremiumPaywall>>;
}) {
  const [resolvedState, setResolvedState, updateResolvedState] =
    useFateState<ResolvedPremiumState | null>(null);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallSessionId, setPaywallSessionId] = useState(0);
  const paywallRequestRef = useRef<PaywallRequest | null>(null);

  const state = getCurrentPremiumState({
    hasSessionError,
    isSessionPending,
    platform,
    resolvedState,
    userId,
  });

  useEffect(() => {
    if (!platform || isSessionPending || hasSessionError) {
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
        updateResolvedState((previous) =>
          getPremiumStateAfterRefreshError(previous, identifiedUserId),
        );
      },
      prepare: () => prepareRevenueCatUser(identifiedUserId),
      refresh: refreshRevenueCatCustomerInfo,
      removeListener: removeRevenueCatCustomerInfoListener,
    });

    return () => {
      connection.disconnect();
    };
  }, [hasSessionError, platform, isSessionPending, userId, setResolvedState, updateResolvedState]);

  const isPremium = state.status === "premium";
  const adEntitlement = state.status === "free" ? "adSupported" : isPremium ? "adFree" : "unknown";

  function updatePremiumEntitlement(entitlement: PremiumEntitlementState) {
    if (!userId) {
      return;
    }

    if (paywallRequestRef.current) {
      paywallRequestRef.current.entitlement = entitlement;
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

    let resolveRequest: PaywallRequest["resolve"] = () => undefined;

    const promise = new Promise<PremiumEntitlementState | null>((resolve) => {
      resolveRequest = resolve;
    });

    paywallRequestRef.current = { promise, resolve: resolveRequest, entitlement: null };
    setPaywallSessionId((sessionId) => sessionId + 1);
    setIsPaywallOpen(true);
    trackEvent("premium_paywall_opened");

    return promise;
  }

  function setPaywallOpen(open: boolean) {
    setIsPaywallOpen(open);

    if (!open) {
      paywallRequestRef.current?.resolve(paywallRequestRef.current.entitlement);
      paywallRequestRef.current = null;
    }
  }

  async function presentCustomerCenter() {
    trackEvent("premium_customer_center_requested");
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
        <Paywall
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
