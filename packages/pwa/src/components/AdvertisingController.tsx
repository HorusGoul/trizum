import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { getLogger } from "#src/lib/log.ts";
import { createAdMobSdk } from "#src/lib/advertising/adMobSdk.ts";
import {
  AdvertisingCoordinator,
  type AdEntitlement,
  type AdHistoryStore,
  type AdvertisingState,
} from "#src/lib/advertising/AdvertisingCoordinator.ts";
import { parseAdHistory, type AdHistory } from "#src/lib/advertising/advertisingPolicy.ts";
import { useAdEntitlement } from "#src/lib/advertising/AdEntitlementContext.tsx";
import { AdvertisingProvider } from "#src/lib/advertising/AdvertisingContext.ts";

const AD_HISTORY_STORAGE_KEY = "trizum.advertising.history:v1";
const BYPASS_FIRST_USE_SESSION_FOR_AD_TESTING = true;
const logger = getLogger("components", "AdvertisingController");

const historyStore: AdHistoryStore = {
  read() {
    try {
      return parseAdHistory(localStorage.getItem(AD_HISTORY_STORAGE_KEY));
    } catch {
      return undefined;
    }
  },
  write(history: AdHistory) {
    try {
      localStorage.setItem(AD_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage can be unavailable in restricted native web views. Staying ad-free is safe.
    }
  },
};

class AdvertisingRuntime {
  private coordinator: AdvertisingCoordinator | null = null;
  private routeProtected = false;
  private readonly protectedFlowTokens = new Set<symbol>();

  readonly presentInterstitialOpportunity = () =>
    this.coordinator?.presentInterstitialOpportunity() ?? false;

  readonly registerProtectedFlow = () => {
    const token = Symbol("protected-ad-flow");
    this.protectedFlowTokens.add(token);
    this.updateProtectedFlow();

    return () => {
      this.protectedFlowTokens.delete(token);
      this.updateProtectedFlow();
    };
  };

  readonly showPrivacyOptions = async () => {
    await this.coordinator?.showPrivacyOptions();
  };

  attachCoordinator(coordinator: AdvertisingCoordinator) {
    this.coordinator = coordinator;
    this.updateProtectedFlow();
  }

  detachCoordinator(coordinator: AdvertisingCoordinator) {
    if (this.coordinator === coordinator) {
      this.coordinator = null;
    }
  }

  setEntitlement(entitlement: AdEntitlement) {
    return this.coordinator?.setEntitlement(entitlement);
  }

  setRouteProtected(protectedFlow: boolean) {
    this.routeProtected = protectedFlow;
    this.updateProtectedFlow();
  }

  private updateProtectedFlow() {
    this.coordinator?.setProtectedFlow(this.routeProtected || this.protectedFlowTokens.size > 0);
  }
}

const advertisingRuntime = new AdvertisingRuntime();

export function AdvertisingController({
  children,
  protectedFlow,
}: {
  children: React.ReactNode;
  protectedFlow: boolean;
}) {
  const entitlement = useAdEntitlement();
  const [state, setState] = useState<AdvertisingState>({ privacyOptionsRequired: false });

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || (platform !== "android" && platform !== "ios")) {
      return;
    }

    const coordinator = new AdvertisingCoordinator({
      platform,
      adUnitIds: getAdUnitIds(platform),
      historyStore,
      createSdk: createAdMobSdk,
      onStateChange: setState,
      bypassFirstUseSession: BYPASS_FIRST_USE_SESSION_FOR_AD_TESTING,
      reportDiagnostic(diagnostic) {
        logger.error("AdMob operation failed", { ...diagnostic });
      },
    });
    advertisingRuntime.setRouteProtected(protectedFlow);
    advertisingRuntime.attachCoordinator(coordinator);
    void advertisingRuntime.setEntitlement(entitlement);

    const interactiveFrame = requestAnimationFrame(() => coordinator.markInteractive());
    const appStateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void coordinator.onActive();
      } else {
        coordinator.onInactive();
      }
    });

    return () => {
      advertisingRuntime.detachCoordinator(coordinator);
      cancelAnimationFrame(interactiveFrame);
      void appStateListener.then((listener) => listener.remove());
      void coordinator.destroy();
    };
    // The coordinator has dedicated effects below for live entitlement and route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void advertisingRuntime.setEntitlement(entitlement);
  }, [entitlement]);

  useEffect(() => {
    advertisingRuntime.setRouteProtected(protectedFlow);
  }, [protectedFlow]);

  return (
    <AdvertisingProvider
      value={{
        privacyOptionsRequired: state.privacyOptionsRequired,
        presentInterstitialOpportunity: advertisingRuntime.presentInterstitialOpportunity,
        registerProtectedFlow: advertisingRuntime.registerProtectedFlow,
        showPrivacyOptions: advertisingRuntime.showPrivacyOptions,
      }}
    >
      {children}
    </AdvertisingProvider>
  );
}

function getAdUnitIds(platform: "android" | "ios") {
  if (platform === "android") {
    return {
      appOpen: import.meta.env.VITE_APP_ADMOB_ANDROID_APP_OPEN_ID,
      interstitial: import.meta.env.VITE_APP_ADMOB_ANDROID_INTERSTITIAL_ID,
    };
  }

  return {
    appOpen: import.meta.env.VITE_APP_ADMOB_IOS_APP_OPEN_ID,
    interstitial: import.meta.env.VITE_APP_ADMOB_IOS_INTERSTITIAL_ID,
  };
}
