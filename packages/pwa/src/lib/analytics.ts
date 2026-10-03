import {
  createAnalytics,
  hasPrivacySignal,
  type Analytics,
  type AnalyticsEvent,
} from "@trizum/analytics";
import { Capacitor } from "@capacitor/core";

let client: Analytics | undefined;

export function initializeAnalytics(routes: readonly string[]) {
  const isProductionHost = window.location.hostname === "trizum.app";
  const isEnabledBuild =
    import.meta.env.VITE_APP_ENABLE_ANALYTICS === "true" ||
    (import.meta.env.MODE === "production" && (isProductionHost || Capacitor.isNativePlatform()));
  if (!isEnabledBuild || import.meta.env.VITE_APP_DISABLE_ANALYTICS === "true") return;

  try {
    client = createAnalytics({
      endpoint: import.meta.env.VITE_APP_ANALYTICS_URL || "https://spycat.horus.dev",
      siteId: "9cf3da44-3ae9-478d-95aa-7015e864557e",
      hostname: "trizum.app",
      routes,
      canCollect: () => !hasPrivacySignal(navigator) && navigator.onLine,
    });
  } catch {
    // A bad optional endpoint must not prevent the app from starting.
  }
}

export function setAnalyticsEnabled(enabled: boolean) {
  client?.setEnabled(enabled);
}

export function trackPage(pathname: string) {
  client?.page(pathname);
}

export function trackEvent(event: AnalyticsEvent) {
  client?.track(event);
}
