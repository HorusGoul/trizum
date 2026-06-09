import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateResultCode,
  type AppUpdateInfo,
  type AppUpdateResult,
  type AppUpdatePlugin,
} from "@capawesome/capacitor-app-update";
import { getLogger } from "#src/lib/log.ts";

const logger = getLogger("lib", "nativeAppUpdate");

export interface NativeAppUpdateState {
  isUpdateAvailable: boolean;
}

export interface NativeAppUpdateResult {
  status: "canceled" | "failed" | "not-allowed" | "started" | "unavailable";
}

interface AndroidUpdateSupport {
  hasAvailableGooglePlayServices: boolean;
  hasGooglePlayServices: boolean;
  hasGooglePlayStore: boolean;
  supportsGooglePlayInAppUpdates: boolean;
  wasInstalledByGooglePlayStore: boolean;
}

interface NativeUpdateEnvironmentPlugin {
  getAndroidAppUpdateInfo: () => Promise<AppUpdateInfo>;
  getAndroidUpdateSupport: () => Promise<AndroidUpdateSupport>;
  performAndroidImmediateUpdate: () => Promise<AppUpdateResult>;
}

const NativeUpdateEnvironment =
  registerPlugin<NativeUpdateEnvironmentPlugin>("NativeUpdateEnvironment");

let pendingAndroidImmediateUpdate: Promise<NativeAppUpdateResult> | null = null;

export async function getNativeAppUpdateState({
  platform = Capacitor.getPlatform(),
  appUpdate = AppUpdate,
  nativeUpdateEnvironment = NativeUpdateEnvironment,
}: {
  platform?: string;
  appUpdate?: AppUpdatePlugin;
  nativeUpdateEnvironment?: NativeUpdateEnvironmentPlugin;
} = {}): Promise<NativeAppUpdateState> {
  if (platform === "android") {
    const androidUpdateSupport = await getAndroidUpdateSupport(nativeUpdateEnvironment);
    if (!androidUpdateSupport.supportsGooglePlayInAppUpdates) {
      return { isUpdateAvailable: false };
    }

    try {
      const result = await nativeUpdateEnvironment.getAndroidAppUpdateInfo();
      return {
        isUpdateAvailable: isNativeUpdateAvailable(result, platform),
      };
    } catch (error) {
      logger.warning("Native Android app update check failed", { error });
      return { isUpdateAvailable: false };
    }
  }

  try {
    const result = await appUpdate.getAppUpdateInfo();
    return {
      isUpdateAvailable: isNativeUpdateAvailable(result, platform),
    };
  } catch (error) {
    logger.warning("Native app update check failed", { error });
    return { isUpdateAvailable: false };
  }
}

export async function performNativeAppUpdate({
  platform = Capacitor.getPlatform(),
  appUpdate = AppUpdate,
  nativeUpdateEnvironment = NativeUpdateEnvironment,
}: {
  platform?: string;
  appUpdate?: AppUpdatePlugin;
  nativeUpdateEnvironment?: NativeUpdateEnvironmentPlugin;
} = {}): Promise<NativeAppUpdateResult> {
  try {
    if (platform === "ios") {
      await appUpdate.openAppStore({
        appId: "6755971747",
      });
      return { status: "started" };
    }

    if (platform === "android") {
      const androidUpdateSupport = await getAndroidUpdateSupport(nativeUpdateEnvironment);
      if (!androidUpdateSupport.supportsGooglePlayInAppUpdates) {
        return { status: "unavailable" };
      }

      const result = await nativeUpdateEnvironment.getAndroidAppUpdateInfo();
      const readiness = getAndroidImmediateUpdateReadiness(result);
      if (readiness === "not-allowed") {
        return { status: "not-allowed" };
      }
      if (readiness === "unavailable") {
        return { status: "unavailable" };
      }

      return await performAndroidImmediateUpdate(nativeUpdateEnvironment);
    }
  } catch (error) {
    logger.warning("Native app update failed", { error });
  }

  return { status: "failed" };
}

export async function resumeNativeAppUpdate({
  platform = Capacitor.getPlatform(),
  nativeUpdateEnvironment = NativeUpdateEnvironment,
}: {
  platform?: string;
  nativeUpdateEnvironment?: NativeUpdateEnvironmentPlugin;
} = {}): Promise<NativeAppUpdateResult> {
  if (platform !== "android") {
    return { status: "unavailable" };
  }

  try {
    const androidUpdateSupport = await getAndroidUpdateSupport(nativeUpdateEnvironment);
    if (!androidUpdateSupport.supportsGooglePlayInAppUpdates) {
      return { status: "unavailable" };
    }

    const result = await nativeUpdateEnvironment.getAndroidAppUpdateInfo();
    if (result.updateAvailability !== AppUpdateAvailability.UPDATE_IN_PROGRESS) {
      return { status: "unavailable" };
    }

    return await performAndroidImmediateUpdate(nativeUpdateEnvironment);
  } catch (error) {
    logger.warning("Native app update resume failed", { error });
    return { status: "failed" };
  }
}

async function getAndroidUpdateSupport(
  nativeUpdateEnvironment: NativeUpdateEnvironmentPlugin,
): Promise<AndroidUpdateSupport> {
  try {
    return await nativeUpdateEnvironment.getAndroidUpdateSupport();
  } catch (error) {
    logger.warning("Android update support check failed", { error });
    return {
      hasAvailableGooglePlayServices: false,
      hasGooglePlayServices: false,
      hasGooglePlayStore: false,
      supportsGooglePlayInAppUpdates: false,
      wasInstalledByGooglePlayStore: false,
    };
  }
}

function performAndroidImmediateUpdate(
  nativeUpdateEnvironment: NativeUpdateEnvironmentPlugin,
): Promise<NativeAppUpdateResult> {
  if (pendingAndroidImmediateUpdate != null) {
    return pendingAndroidImmediateUpdate;
  }

  pendingAndroidImmediateUpdate = nativeUpdateEnvironment
    .performAndroidImmediateUpdate()
    .then(mapAppUpdateResult)
    .catch((error: unknown) => {
      logger.warning("Native Android immediate update failed", { error });
      return { status: "failed" } satisfies NativeAppUpdateResult;
    })
    .finally(() => {
      pendingAndroidImmediateUpdate = null;
    });

  return pendingAndroidImmediateUpdate;
}

function isNativeUpdateAvailable(result: AppUpdateInfo, platform: string): boolean {
  if (
    platform === "android" &&
    result.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS
  ) {
    return true;
  }

  if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
    return false;
  }

  if (platform === "android") {
    return result.immediateUpdateAllowed === true;
  }

  return true;
}

function getAndroidImmediateUpdateReadiness(
  result: AppUpdateInfo,
): "ready" | "not-allowed" | "unavailable" {
  if (result.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS) {
    return "ready";
  }

  if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
    return "unavailable";
  }

  if (result.immediateUpdateAllowed !== true) {
    return "not-allowed";
  }

  return "ready";
}

function mapAppUpdateResult(result: AppUpdateResult): NativeAppUpdateResult {
  if (result.code === AppUpdateResultCode.OK) {
    return { status: "started" };
  }

  if (result.code === AppUpdateResultCode.CANCELED) {
    return { status: "canceled" };
  }

  if (result.code === AppUpdateResultCode.NOT_AVAILABLE) {
    return { status: "unavailable" };
  }

  if (result.code === AppUpdateResultCode.NOT_ALLOWED) {
    return { status: "not-allowed" };
  }

  logger.warning("Native app update did not start", { result });
  return { status: "failed" };
}
