import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import { getLogger } from "#src/lib/log.ts";
import { createAdMobSdk } from "#src/lib/advertising/adMobSdk.ts";
import {
  AdvertisingCoordinator,
  type AdHistoryStore,
  type AdvertisingState,
} from "#src/lib/advertising/AdvertisingCoordinator.ts";
import { parseAdHistory, type AdHistory } from "#src/lib/advertising/advertisingPolicy.ts";
import { useAdEntitlement } from "#src/lib/advertising/AdEntitlementContext.tsx";
import { AdvertisingProvider } from "#src/lib/advertising/AdvertisingContext.ts";

const AD_HISTORY_STORAGE_KEY = "trizum.advertising.history:v1";
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

export function AdvertisingController({
  children,
  protectedFlow,
}: {
  children: React.ReactNode;
  protectedFlow: boolean;
}) {
  const entitlement = useAdEntitlement();
  const coordinatorRef = useRef<AdvertisingCoordinator | null>(null);
  const routeProtectedRef = useRef(protectedFlow);
  const protectedFlowTokensRef = useRef(new Set<symbol>());
  const registerProtectedFlowRef = useRef<(() => () => void) | null>(null);
  const [state, setState] = useState<AdvertisingState>({ privacyOptionsRequired: false });

  registerProtectedFlowRef.current ??= () => {
    const token = Symbol("protected-ad-flow");
    protectedFlowTokensRef.current.add(token);
    updateProtectedFlow();

    return () => {
      protectedFlowTokensRef.current.delete(token);
      updateProtectedFlow();
    };
  };

  function updateProtectedFlow() {
    coordinatorRef.current?.setProtectedFlow(
      routeProtectedRef.current || protectedFlowTokensRef.current.size > 0,
    );
  }

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
      reportDiagnostic(diagnostic) {
        logger.error("AdMob operation failed", { ...diagnostic });
      },
    });
    coordinatorRef.current = coordinator;
    updateProtectedFlow();
    void coordinator.setEntitlement(entitlement);

    const interactiveFrame = requestAnimationFrame(() => coordinator.markInteractive());
    const appStateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void coordinator.onActive();
      } else {
        coordinator.onInactive();
      }
    });

    return () => {
      coordinatorRef.current = null;
      cancelAnimationFrame(interactiveFrame);
      void appStateListener.then((listener) => listener.remove());
      void coordinator.destroy();
    };
    // The coordinator has dedicated effects below for live entitlement and route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void coordinatorRef.current?.setEntitlement(entitlement);
  }, [entitlement]);

  useEffect(() => {
    routeProtectedRef.current = protectedFlow;
    updateProtectedFlow();
  }, [protectedFlow]);

  return (
    <AdvertisingProvider
      value={{
        privacyOptionsRequired: state.privacyOptionsRequired,
        presentInterstitialOpportunity: () =>
          coordinatorRef.current?.presentInterstitialOpportunity() ?? false,
        registerProtectedFlow: registerProtectedFlowRef.current,
        showPrivacyOptions: async () => coordinatorRef.current?.showPrivacyOptions(),
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
