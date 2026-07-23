import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { AdmobConsentInfo } from "@capacitor-community/admob";

export type AdFormat = "appOpen" | "interstitial";
export type FullScreenAdEvent = "shown" | "dismissed" | "failedToShow";

export interface AdMobSdk {
  requestConsentInfo: () => Promise<AdmobConsentInfo>;
  showConsentForm: () => Promise<AdmobConsentInfo>;
  showPrivacyOptionsForm: () => Promise<void>;
  trackingAuthorizationStatus: () => Promise<
    "authorized" | "denied" | "notDetermined" | "restricted"
  >;
  requestTrackingAuthorization: () => Promise<void>;
  initialize: () => Promise<void>;
  prepareInterstitial: (adId: string) => Promise<void>;
  showInterstitial: () => Promise<void>;
  loadAppOpen: (adId: string) => Promise<void>;
  showAppOpen: () => Promise<void>;
  isAppOpenLoaded: () => Promise<boolean>;
  removeListeners: () => Promise<void>;
}

interface NativeAppOpenAdPlugin {
  load(options: { adId: string }): Promise<void>;
  show(): Promise<void>;
  isLoaded(): Promise<{ value: boolean }>;
  addListener(
    eventName: "nativeAppOpenAdShown" | "nativeAppOpenAdDismissed",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "nativeAppOpenAdFailedToShow",
    listener: (error: { code?: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeAppOpenAd = registerPlugin<NativeAppOpenAdPlugin>("NativeAppOpenAd");

export async function createAdMobSdk(
  onFullScreenEvent: (format: AdFormat, event: FullScreenAdEvent, errorCode?: number) => void,
): Promise<AdMobSdk> {
  const { AdMob, InterstitialAdPluginEvents, MaxAdContentRating } =
    await import("@capacitor-community/admob");
  const handles: PluginListenerHandle[] = [];
  try {
    handles.push(
      await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
        onFullScreenEvent("interstitial", "shown");
      }),
      await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        onFullScreenEvent("interstitial", "dismissed");
      }),
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
        onFullScreenEvent("interstitial", "failedToShow", error.code);
      }),
      await NativeAppOpenAd.addListener("nativeAppOpenAdShown", () => {
        onFullScreenEvent("appOpen", "shown");
      }),
      await NativeAppOpenAd.addListener("nativeAppOpenAdDismissed", () => {
        onFullScreenEvent("appOpen", "dismissed");
      }),
      await NativeAppOpenAd.addListener("nativeAppOpenAdFailedToShow", (error) => {
        onFullScreenEvent("appOpen", "failedToShow", error.code);
      }),
    );
  } catch (error) {
    await Promise.all(handles.map((handle) => handle.remove()));
    throw error;
  }

  return {
    requestConsentInfo: () => AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false }),
    showConsentForm: () => AdMob.showConsentForm(),
    showPrivacyOptionsForm: () => AdMob.showPrivacyOptionsForm(),
    async trackingAuthorizationStatus() {
      return (await AdMob.trackingAuthorizationStatus()).status;
    },
    requestTrackingAuthorization: () => AdMob.requestTrackingAuthorization(),
    initialize: () =>
      AdMob.initialize({
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        maxAdContentRating: MaxAdContentRating.ParentalGuidance,
      }),
    async prepareInterstitial(adId) {
      await AdMob.prepareInterstitial({ adId });
    },
    showInterstitial: () => AdMob.showInterstitial(),
    loadAppOpen: (adId) => NativeAppOpenAd.load({ adId }),
    showAppOpen: () => NativeAppOpenAd.show(),
    async isAppOpenLoaded() {
      return (await NativeAppOpenAd.isLoaded()).value;
    },
    async removeListeners() {
      await Promise.all(handles.map((handle) => handle.remove()));
    },
  };
}
