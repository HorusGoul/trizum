import { describe, expect, it, vi } from "vite-plus/test";
import { AdmobConsentStatus, type AdmobConsentInfo } from "@capacitor-community/admob";
import type { AdMobSdk, FullScreenAdEvent, AdFormat } from "./adMobSdk.ts";
import {
  AdvertisingCoordinator,
  type AdDiagnostic,
  type AdHistoryStore,
  type AdvertisingState,
} from "./AdvertisingCoordinator.ts";
import { AD_SESSION_GAP_MS, type AdHistory } from "./advertisingPolicy.ts";

const consentReady = {
  status: AdmobConsentStatus.NOT_REQUIRED,
  isConsentFormAvailable: false,
  canRequestAds: true,
  privacyOptionsRequirementStatus:
    "NOT_REQUIRED" as AdmobConsentInfo["privacyOptionsRequirementStatus"],
} satisfies AdmobConsentInfo;

function createHarness({
  firstUseCompleted = true,
  bypassFirstUseSession = false,
}: { firstUseCompleted?: boolean; bypassFirstUseSession?: boolean } = {}) {
  let now = 10_000;
  let stored: AdHistory | undefined = firstUseCompleted
    ? { version: 1, firstUseCompleted: true }
    : undefined;
  let fullScreenEvent:
    | ((format: AdFormat, event: FullScreenAdEvent, errorCode?: number) => void)
    | undefined;
  const historyStore: AdHistoryStore = {
    read: () => stored,
    write: (history) => {
      stored = structuredClone(history);
    },
  };
  const sdk: AdMobSdk = {
    requestConsentInfo: vi.fn<AdMobSdk["requestConsentInfo"]>(async () => consentReady),
    showConsentForm: vi.fn<AdMobSdk["showConsentForm"]>(async () => consentReady),
    showPrivacyOptionsForm: vi.fn<AdMobSdk["showPrivacyOptionsForm"]>(async () => undefined),
    trackingAuthorizationStatus: vi.fn<AdMobSdk["trackingAuthorizationStatus"]>(() =>
      Promise.resolve("restricted" as const),
    ),
    requestTrackingAuthorization: vi.fn<AdMobSdk["requestTrackingAuthorization"]>(
      async () => undefined,
    ),
    initialize: vi.fn<AdMobSdk["initialize"]>(async () => undefined),
    prepareInterstitial: vi.fn<AdMobSdk["prepareInterstitial"]>(async () => undefined),
    showInterstitial: vi.fn<AdMobSdk["showInterstitial"]>(async () => undefined),
    loadAppOpen: vi.fn<AdMobSdk["loadAppOpen"]>(async () => undefined),
    showAppOpen: vi.fn<AdMobSdk["showAppOpen"]>(async () => undefined),
    isAppOpenLoaded: vi.fn<AdMobSdk["isAppOpenLoaded"]>(async () => true),
    removeListeners: vi.fn<AdMobSdk["removeListeners"]>(async () => undefined),
  };
  const createSdk = vi.fn<
    (
      listener: (format: AdFormat, event: FullScreenAdEvent, errorCode?: number) => void,
    ) => Promise<AdMobSdk>
  >(async (listener: (format: AdFormat, event: FullScreenAdEvent, errorCode?: number) => void) => {
    fullScreenEvent = listener;
    return sdk;
  });
  const reportDiagnostic = vi.fn<(diagnostic: AdDiagnostic) => void>();
  const onStateChange = vi.fn<(state: AdvertisingState) => void>();
  const coordinator = new AdvertisingCoordinator({
    platform: "android",
    adUnitIds: { appOpen: "app-open", interstitial: "interstitial" },
    historyStore,
    createSdk,
    reportDiagnostic,
    onStateChange,
    now: () => now,
    bypassFirstUseSession,
  });

  return {
    coordinator,
    createSdk,
    sdk,
    reportDiagnostic,
    onStateChange,
    get history() {
      return stored;
    },
    advance(milliseconds: number) {
      now += milliseconds;
    },
    emit(format: AdFormat, event: FullScreenAdEvent, errorCode?: number) {
      fullScreenEvent?.(format, event, errorCode);
    },
  };
}

describe("AdvertisingCoordinator", () => {
  it("does not load the SDK for unknown or ad-free entitlements", async () => {
    const harness = createHarness();

    await harness.coordinator.setEntitlement("unknown");
    await harness.coordinator.setEntitlement("adFree");

    expect(harness.createSdk).not.toHaveBeenCalled();
  });

  it("keeps new and upgraded installations ad-free for their first session", async () => {
    const harness = createHarness({ firstUseCompleted: false });
    await harness.coordinator.setEntitlement("adSupported");
    expect(harness.createSdk).not.toHaveBeenCalled();

    harness.coordinator.onInactive();
    harness.advance(AD_SESSION_GAP_MS);
    await harness.coordinator.onActive();

    expect(harness.history?.firstUseCompleted).toBe(true);
    expect(harness.createSdk).toHaveBeenCalledOnce();
  });

  it("requests consent immediately when first-use protection is bypassed", async () => {
    const harness = createHarness({
      firstUseCompleted: false,
      bypassFirstUseSession: true,
    });
    const consentRequired = {
      ...consentReady,
      status: AdmobConsentStatus.REQUIRED,
      isConsentFormAvailable: true,
      privacyOptionsRequirementStatus:
        "REQUIRED" as AdmobConsentInfo["privacyOptionsRequirementStatus"],
    } satisfies AdmobConsentInfo;
    vi.mocked(harness.sdk.requestConsentInfo).mockResolvedValue(consentRequired);
    vi.mocked(harness.sdk.showConsentForm).mockResolvedValue(consentRequired);

    await harness.coordinator.setEntitlement("adSupported");

    expect(harness.sdk.requestConsentInfo).toHaveBeenCalledOnce();
    expect(harness.sdk.showConsentForm).toHaveBeenCalledOnce();
    expect(harness.onStateChange).toHaveBeenCalledWith({ privacyOptionsRequired: true });
  });

  it("starts the shared cooldown only after an ad becomes visible", async () => {
    const harness = createHarness();
    harness.coordinator.markInteractive();
    await harness.coordinator.setEntitlement("adSupported");

    expect(harness.coordinator.presentInterstitialOpportunity()).toBe(true);
    expect(harness.history?.lastFullScreenShownAt).toBeUndefined();

    harness.emit("interstitial", "shown");
    harness.emit("interstitial", "dismissed");

    expect(harness.history?.lastFullScreenShownAt).toBeDefined();
    expect(harness.coordinator.presentInterstitialOpportunity()).toBe(false);
  });

  it("does not show a cold app-open ad after presenting a consent form", async () => {
    const harness = createHarness();
    vi.mocked(harness.sdk.requestConsentInfo).mockResolvedValue({
      ...consentReady,
      status: AdmobConsentStatus.REQUIRED,
      isConsentFormAvailable: true,
    });

    await harness.coordinator.setEntitlement("adSupported");

    expect(harness.sdk.showConsentForm).toHaveBeenCalledOnce();
    expect(harness.sdk.loadAppOpen).toHaveBeenCalledOnce();
    expect(harness.sdk.showAppOpen).not.toHaveBeenCalled();
  });

  it("retries a failed consent refresh only in a later session", async () => {
    const harness = createHarness();
    vi.mocked(harness.sdk.requestConsentInfo)
      .mockRejectedValueOnce({ code: 7 })
      .mockResolvedValue(consentReady);

    await harness.coordinator.setEntitlement("adSupported");
    expect(harness.reportDiagnostic).toHaveBeenCalledWith({
      platform: "android",
      stage: "consent",
      code: "7",
    });

    harness.coordinator.onInactive();
    harness.advance(AD_SESSION_GAP_MS);
    await harness.coordinator.onActive();

    expect(harness.sdk.requestConsentInfo).toHaveBeenCalledTimes(2);
    expect(harness.sdk.initialize).toHaveBeenCalledOnce();
  });

  it("retries SDK creation after a failure in a later session", async () => {
    const harness = createHarness();
    harness.createSdk.mockRejectedValueOnce({ code: "bridge-unavailable" });

    await harness.coordinator.setEntitlement("adSupported");
    expect(harness.createSdk).toHaveBeenCalledOnce();

    harness.coordinator.onInactive();
    harness.advance(AD_SESSION_GAP_MS);
    await harness.coordinator.onActive();

    expect(harness.createSdk).toHaveBeenCalledTimes(2);
    expect(harness.sdk.initialize).toHaveBeenCalledOnce();
  });
});
