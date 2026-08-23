import type { AdmobConsentInfo } from "@capacitor-community/admob";
import type { AdFormat, AdMobSdk, FullScreenAdEvent } from "./adMobSdk.ts";
import {
  createAdHistory,
  isFullScreenAdCoolingDown,
  isPreparedAppOpenFresh,
  recordFullScreenAdShown,
  resumeAdHistory,
  suspendAdHistory,
  type AdHistory,
} from "./advertisingPolicy.ts";

export type AdEntitlement = "unknown" | "adFree" | "adSupported";
export type AdPlatform = "android" | "ios";
export type AdDiagnosticStage =
  | "consent"
  | "initialization"
  | "load"
  | "show"
  | "privacyOptions"
  | "trackingPermission";

export interface AdvertisingState {
  privacyOptionsRequired: boolean;
}

export interface AdDiagnostic {
  platform: AdPlatform;
  format?: AdFormat;
  stage: AdDiagnosticStage;
  code: string;
}

export interface AdHistoryStore {
  read(): AdHistory | undefined;
  write(history: AdHistory): void;
}

interface AdvertisingCoordinatorOptions {
  platform: AdPlatform;
  adUnitIds: {
    appOpen: string;
    interstitial: string;
  };
  historyStore: AdHistoryStore;
  createSdk: (
    onFullScreenEvent: (format: AdFormat, event: FullScreenAdEvent, errorCode?: number) => void,
  ) => Promise<AdMobSdk>;
  reportDiagnostic: (diagnostic: AdDiagnostic) => void;
  onStateChange: (state: AdvertisingState) => void;
  bypassFirstUseSession?: boolean;
  now?: () => number;
}

export class AdvertisingCoordinator {
  private readonly options: AdvertisingCoordinatorOptions;
  private readonly now: () => number;
  private history: AdHistory;
  private entitlement: AdEntitlement = "unknown";
  private entitlementRevision = 0;
  private sdk: AdMobSdk | undefined;
  private sdkPromise: Promise<AdMobSdk> | undefined;
  private consentRefresh: Promise<void> | undefined;
  private initialized = false;
  private consentReady = false;
  private consentFailedForSession = false;
  private privacySurfacePresentedOnLaunch = false;
  private privacyOptionsRequired = false;
  private coldLaunchWindowOpen = true;
  private coldLaunchStarted = false;
  private protectedFlow = false;
  private interstitialPrepared = false;
  private interstitialLoading = false;
  private appOpenPreparedAt: number | undefined;
  private appOpenLoading = false;
  private presenting = false;
  private destroyed = false;

  constructor(options: AdvertisingCoordinatorOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;

    const persisted = options.historyStore.read();
    if (persisted) {
      const resumed = resumeAdHistory(persisted, this.now());
      this.history = resumed.history;
    } else {
      this.history = createAdHistory();
    }
    if (options.bypassFirstUseSession) {
      this.history = { ...this.history, firstUseCompleted: true };
    }
    this.persistHistory();
  }

  async setEntitlement(entitlement: AdEntitlement) {
    const entitlementChanged = entitlement !== this.entitlement;
    this.entitlement = entitlement;
    if (entitlementChanged) {
      this.entitlementRevision += 1;
    }
    if (entitlement !== "adSupported" || !this.history.firstUseCompleted) {
      return;
    }

    if (!this.coldLaunchStarted) {
      this.coldLaunchStarted = true;
      await this.refreshForLaunch("cold", false);
      return;
    }

    if (entitlementChanged) {
      await this.consentRefresh;
      const entitlementRevision = this.entitlementRevision;
      if (this.isEligibilityCurrent(entitlementRevision)) {
        await this.refreshForLaunch("cold", false);
      }
    }
  }

  setProtectedFlow(protectedFlow: boolean) {
    this.protectedFlow = protectedFlow;
  }

  markInteractive() {
    this.coldLaunchWindowOpen = false;
  }

  onInactive() {
    this.history = suspendAdHistory(this.history, this.now());
    this.persistHistory();
  }

  async onActive() {
    const hadPreparedAppOpen = this.isAppOpenPrepared();
    const resumed = resumeAdHistory(this.history, this.now());
    this.history = resumed.history;
    this.persistHistory();

    if (!resumed.startedNewSession) {
      return;
    }

    this.consentFailedForSession = false;
    this.consentReady = false;
    this.privacySurfacePresentedOnLaunch = false;

    if (this.entitlement === "adSupported" && this.history.firstUseCompleted) {
      await this.refreshForLaunch("warm", hadPreparedAppOpen);
    }
  }

  presentInterstitialOpportunity() {
    if (!this.canPresent() || !this.interstitialPrepared || !this.sdk) {
      if (this.canPrepareAds()) {
        void this.prepareInterstitial();
      }
      return false;
    }

    this.presenting = true;
    this.interstitialPrepared = false;
    void this.sdk.showInterstitial().catch(() => {
      if (this.presenting) {
        this.onFullScreenEvent("interstitial", "failedToShow");
      }
    });
    return true;
  }

  async showPrivacyOptions() {
    if (!this.privacyOptionsRequired || !this.sdk || this.destroyed) {
      return;
    }

    const entitlementRevision = this.entitlementRevision;
    try {
      await this.sdk.showPrivacyOptionsForm();
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      const consent = await this.sdk.requestConsentInfo();
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      this.updatePrivacyOptionsRequirement(consent);
      this.consentReady = consent.canRequestAds;
      if (consent.canRequestAds) {
        await this.initializeAndPrepare(false, entitlementRevision);
      }
    } catch (error) {
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      this.suppressAdsForSession("privacyOptions", error);
    }
  }

  async destroy() {
    this.destroyed = true;
    if (this.sdk) {
      await this.sdk.removeListeners();
    }
  }

  private async refreshForLaunch(kind: "cold" | "warm", hadPreparedAppOpen: boolean) {
    if (this.consentRefresh || this.destroyed || this.consentFailedForSession) {
      return this.consentRefresh;
    }

    const entitlementRevision = this.entitlementRevision;
    this.consentRefresh = this.performConsentRefresh(
      kind,
      hadPreparedAppOpen,
      entitlementRevision,
    ).finally(() => {
      this.consentRefresh = undefined;
    });
    return this.consentRefresh;
  }

  private async performConsentRefresh(
    kind: "cold" | "warm",
    hadPreparedAppOpen: boolean,
    entitlementRevision: number,
  ) {
    try {
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      const sdk = await this.getSdk();
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      let consent = await sdk.requestConsentInfo();
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      this.updatePrivacyOptionsRequirement(consent);

      let trackingStatus =
        this.options.platform === "ios"
          ? await sdk.trackingAuthorizationStatus()
          : ("restricted" as const);
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      const shouldPresentConsentForm =
        consent.isConsentFormAvailable === true &&
        (consent.status === "REQUIRED" ||
          (this.options.platform === "ios" && trackingStatus === "notDetermined"));

      if (shouldPresentConsentForm) {
        consent = await sdk.showConsentForm();
        if (!this.isEligibilityCurrent(entitlementRevision)) {
          return;
        }
        this.privacySurfacePresentedOnLaunch = true;
        this.updatePrivacyOptionsRequirement(consent);
      }

      if (this.options.platform === "ios") {
        trackingStatus = await sdk.trackingAuthorizationStatus();
        if (!this.isEligibilityCurrent(entitlementRevision)) {
          return;
        }
        if (trackingStatus === "notDetermined") {
          try {
            await sdk.requestTrackingAuthorization();
            if (!this.isEligibilityCurrent(entitlementRevision)) {
              return;
            }
            this.privacySurfacePresentedOnLaunch = true;
          } catch (error) {
            if (!this.isEligibilityCurrent(entitlementRevision)) {
              return;
            }
            this.reportDiagnostic("trackingPermission", error);
          }
        }
      }

      if (!consent.canRequestAds) {
        this.consentReady = false;
        return;
      }

      this.consentReady = true;
      await this.initializeAndPrepare(
        kind === "cold" && !this.privacySurfacePresentedOnLaunch && this.coldLaunchWindowOpen,
        entitlementRevision,
      );

      if (
        kind === "warm" &&
        hadPreparedAppOpen &&
        !this.privacySurfacePresentedOnLaunch &&
        !this.protectedFlow
      ) {
        await this.presentAppOpenOpportunity();
      }
    } catch (error) {
      if (!this.isEligibilityCurrent(entitlementRevision)) {
        return;
      }
      this.suppressAdsForSession("consent", error);
    }
  }

  private async initializeAndPrepare(
    showColdAppOpenWhenReady = false,
    entitlementRevision = this.entitlementRevision,
  ) {
    if (!this.isEligibilityCurrent(entitlementRevision)) {
      return;
    }
    const sdk = await this.getSdk();
    if (!this.isEligibilityCurrent(entitlementRevision)) {
      return;
    }
    if (!this.initialized) {
      try {
        await sdk.initialize();
        if (!this.isEligibilityCurrent(entitlementRevision)) {
          return;
        }
        this.initialized = true;
      } catch (error) {
        this.suppressAdsForSession("initialization", error);
        return;
      }
    }

    await Promise.all([this.prepareInterstitial(), this.prepareAppOpen(showColdAppOpenWhenReady)]);
  }

  private async prepareInterstitial() {
    if (
      !this.canPrepareAds() ||
      this.interstitialPrepared ||
      this.interstitialLoading ||
      !this.sdk
    ) {
      return;
    }

    this.interstitialLoading = true;
    try {
      await this.sdk.prepareInterstitial(this.options.adUnitIds.interstitial);
      this.interstitialPrepared = true;
    } catch (error) {
      this.reportDiagnostic("load", error, "interstitial");
    } finally {
      this.interstitialLoading = false;
    }
  }

  private async prepareAppOpen(showWhenReady: boolean) {
    if (!this.canPrepareAds() || this.isAppOpenPrepared() || this.appOpenLoading || !this.sdk) {
      return;
    }

    this.appOpenPreparedAt = undefined;
    this.appOpenLoading = true;
    try {
      await this.sdk.loadAppOpen(this.options.adUnitIds.appOpen);
      this.appOpenPreparedAt = this.now();
      if (
        showWhenReady &&
        this.coldLaunchWindowOpen &&
        !this.privacySurfacePresentedOnLaunch &&
        !this.protectedFlow
      ) {
        await this.presentAppOpenOpportunity();
      }
    } catch (error) {
      this.reportDiagnostic("load", error, "appOpen");
    } finally {
      this.appOpenLoading = false;
    }
  }

  private async presentAppOpenOpportunity() {
    if (!this.canPresent() || !this.isAppOpenPrepared() || !this.sdk) {
      if (this.canPrepareAds()) {
        void this.prepareAppOpen(false);
      }
      return false;
    }

    try {
      if (!(await this.sdk.isAppOpenLoaded())) {
        this.appOpenPreparedAt = undefined;
        void this.prepareAppOpen(false);
        return false;
      }
    } catch (error) {
      this.reportDiagnostic("show", error, "appOpen");
      this.appOpenPreparedAt = undefined;
      return false;
    }

    this.presenting = true;
    this.appOpenPreparedAt = undefined;
    void this.sdk.showAppOpen().catch(() => {
      if (this.presenting) {
        this.onFullScreenEvent("appOpen", "failedToShow");
      }
    });
    return true;
  }

  private onFullScreenEvent(format: AdFormat, event: FullScreenAdEvent, errorCode?: number) {
    if (event === "shown") {
      this.history = recordFullScreenAdShown(this.history, this.now());
      this.persistHistory();
      return;
    }

    this.presenting = false;
    if (event === "failedToShow") {
      this.options.reportDiagnostic({
        platform: this.options.platform,
        format,
        stage: "show",
        code: errorCode === undefined ? "unknown" : String(errorCode),
      });
    }

    if (this.canPrepareAds()) {
      void this.prepareInterstitial();
      void this.prepareAppOpen(false);
    }
  }

  private canPrepareAds() {
    return (
      !this.destroyed &&
      this.entitlement === "adSupported" &&
      this.history.firstUseCompleted &&
      this.consentReady &&
      !this.consentFailedForSession &&
      this.initialized
    );
  }

  private isEligibilityCurrent(entitlementRevision: number) {
    return (
      entitlementRevision === this.entitlementRevision &&
      !this.destroyed &&
      this.entitlement === "adSupported" &&
      this.history.firstUseCompleted
    );
  }

  private canPresent() {
    return (
      this.canPrepareAds() &&
      !this.protectedFlow &&
      !this.presenting &&
      !isFullScreenAdCoolingDown(this.history, this.now())
    );
  }

  private isAppOpenPrepared() {
    if (!isPreparedAppOpenFresh(this.appOpenPreparedAt, this.now())) {
      this.appOpenPreparedAt = undefined;
      return false;
    }
    return true;
  }

  private async getSdk() {
    if (this.sdk) {
      return this.sdk;
    }

    if (!this.sdkPromise) {
      this.sdkPromise = this.options.createSdk((format, event, errorCode) => {
        this.onFullScreenEvent(format, event, errorCode);
      });
    }

    const sdkPromise = this.sdkPromise;
    try {
      this.sdk = await sdkPromise;
      return this.sdk;
    } catch (error) {
      if (this.sdkPromise === sdkPromise) {
        this.sdkPromise = undefined;
      }
      throw error;
    }
  }

  private updatePrivacyOptionsRequirement(consent: AdmobConsentInfo) {
    const required = consent.privacyOptionsRequirementStatus === "REQUIRED";
    if (required === this.privacyOptionsRequired) {
      return;
    }

    this.privacyOptionsRequired = required;
    this.options.onStateChange({ privacyOptionsRequired: required });
  }

  private suppressAdsForSession(stage: AdDiagnosticStage, error: unknown) {
    this.consentReady = false;
    this.consentFailedForSession = true;
    this.reportDiagnostic(stage, error);
  }

  private reportDiagnostic(stage: AdDiagnosticStage, error: unknown, format?: AdFormat) {
    this.options.reportDiagnostic({
      platform: this.options.platform,
      format,
      stage,
      code: getSanitizedErrorCode(error),
    });
  }

  private persistHistory() {
    this.options.historyStore.write(this.history);
  }
}

function getSanitizedErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof error.code === "number" || typeof error.code === "string")
  ) {
    return String(error.code);
  }
  return "unknown";
}
