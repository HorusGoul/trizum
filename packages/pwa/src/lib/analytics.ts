import {
  createAnalytics,
  hasPrivacySignal,
  type Analytics,
  type AnalyticsEvent,
} from "@trizum/analytics";
import { Capacitor } from "@capacitor/core";
import type { DocHandle, DocumentId } from "@automerge/automerge-repo/slim";
import {
  ensureTelemetryId,
  subscribeToPartyListId,
  type PartyList,
} from "#src/models/partyList.ts";
import { getTelemetryId, setTelemetryIdentity } from "./telemetry.ts";
import { ANALYTICS_PROXY_PATH, ANALYTICS_SITE_ID } from "./api/analyticsConfig.ts";

let client: Analytics | undefined;
let activation: { destination: DocumentId; expiresAt: number } | undefined;

export function initializeAnalytics(routes: readonly string[]) {
  const isProductionHost = window.location.hostname === "trizum.app";
  const isEnabledBuild =
    import.meta.env.VITE_APP_ENABLE_ANALYTICS === "true" ||
    (import.meta.env.MODE === "production" && (isProductionHost || Capacitor.isNativePlatform()));
  if (!isEnabledBuild || import.meta.env.VITE_APP_DISABLE_ANALYTICS === "true") return;

  try {
    client = createAnalytics({
      endpoint:
        import.meta.env.VITE_APP_ANALYTICS_URL ||
        new URL(
          ANALYTICS_PROXY_PATH,
          Capacitor.isNativePlatform() ? "https://trizum.app" : window.location.origin,
        ).href,
      siteId: ANALYTICS_SITE_ID,
      hostname: "trizum.app",
      routes,
      canCollect: () => !hasPrivacySignal(navigator) && navigator.onLine,
    });
  } catch {
    // A bad optional endpoint must not prevent the app from starting.
  }
}

export function setAnalyticsEnabled(enabled: boolean) {
  if (!enabled) {
    activation = undefined;
    setTelemetryIdentity();
  }
  client?.setEnabled(enabled, getTelemetryId());
}

/** Switching clears the old visit; count success only once the destination is ready. */
export function trackCloudSyncActivated(destination: DocumentId) {
  activation = { destination, expiresAt: Date.now() + 10_000 };
}

/** One subscription owns the current profile, including changes received through sync. */
export function bindAnalytics(handle: DocHandle<PartyList>, getPathname: () => string) {
  let active = true;
  let updating = false;
  function update() {
    if (!active || updating) return;
    if (handle.doc().usageAnalyticsEnabled === false || hasPrivacySignal(navigator)) {
      setAnalyticsEnabled(false);
      return;
    }
    updating = true;
    try {
      ensureTelemetryId(handle);
      setTelemetryIdentity(() => {
        const doc = handle.doc();
        return active && doc.usageAnalyticsEnabled !== false ? doc.telemetryId : undefined;
      });
      client?.setEnabled(navigator.onLine, getTelemetryId());
      trackPage(getPathname());
      if (activation) {
        const pending = activation;
        activation = undefined;
        if (pending.destination === handle.documentId && Date.now() < pending.expiresAt) {
          trackEvent("cloud_sync_activated");
        }
      }
    } finally {
      updating = false;
    }
  }
  const unsubscribe = subscribeToPartyListId((id) => {
    if (id !== handle.documentId) {
      active = false;
      activation = undefined;
      setAnalyticsEnabled(false);
    }
  });
  handle.on("change", update);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  window.addEventListener("focus", update);
  update();
  return () => {
    active = false;
    unsubscribe();
    handle.off("change", update);
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
    window.removeEventListener("focus", update);
    client?.setEnabled(false);
    setTelemetryIdentity();
  };
}

export function trackPage(pathname: string) {
  client?.page(pathname);
}

export function trackEvent(event: AnalyticsEvent) {
  client?.track(event);
}
