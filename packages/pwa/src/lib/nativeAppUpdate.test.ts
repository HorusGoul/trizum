import { describe, expect, test, vi } from "vite-plus/test";
import {
  type AppUpdateInfo,
  AppUpdateAvailability,
  type AppUpdateResult,
  AppUpdateResultCode,
  type AppUpdatePlugin,
} from "@capawesome/capacitor-app-update";
import {
  getNativeAppUpdateState,
  performNativeAppUpdate,
  resumeNativeAppUpdate,
} from "./nativeAppUpdate.ts";

vi.mock("#src/lib/log.ts", () => ({
  getLogger: () => ({
    warning() {},
  }),
}));

describe("native app updates", () => {
  test("does not call Play update APIs when Android has no Google Play support", async () => {
    const getAppUpdateInfo = createGetAppUpdateInfoMock();
    const appUpdate = createAppUpdate({ getAppUpdateInfo });
    const getAndroidAppUpdateInfo = createGetAndroidAppUpdateInfoMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      getAndroidAppUpdateInfo,
      support: createUnsupportedAndroidUpdateSupport(),
    });

    await expect(
      getNativeAppUpdateState({
        appUpdate,
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ isUpdateAvailable: false });

    expect(getAppUpdateInfo).not.toHaveBeenCalled();
    expect(getAndroidAppUpdateInfo).not.toHaveBeenCalled();
  });

  test("treats native update check failures as unavailable updates", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      getAndroidAppUpdateInfo: vi.fn<() => Promise<AppUpdateInfo>>(() =>
        Promise.reject(new Error("Google Play unavailable")),
      ),
    });

    await expect(
      getNativeAppUpdateState({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ isUpdateAvailable: false });
  });

  test("detects available native updates when Play update APIs succeed", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
    });

    await expect(
      getNativeAppUpdateState({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ isUpdateAvailable: true });
  });

  test("detects in-progress Android immediate updates", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: false,
        updateAvailability: AppUpdateAvailability.UPDATE_IN_PROGRESS,
      }),
    });

    await expect(
      getNativeAppUpdateState({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ isUpdateAvailable: true });
  });

  test("does not report Android updates when immediate updates are not allowed", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: false,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
    });

    await expect(
      getNativeAppUpdateState({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ isUpdateAvailable: false });
  });

  test("does not start Android updates when Google Play support is missing", async () => {
    const performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      performAndroidImmediateUpdate,
      support: createUnsupportedAndroidUpdateSupport(),
    });

    await expect(
      performNativeAppUpdate({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    expect(performAndroidImmediateUpdate).not.toHaveBeenCalled();
  });

  test("does not start Android updates when immediate updates are not allowed", async () => {
    const performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: false,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
      performAndroidImmediateUpdate,
    });

    await expect(
      performNativeAppUpdate({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "not-allowed" });

    expect(performAndroidImmediateUpdate).not.toHaveBeenCalled();
  });

  test("starts Android immediate updates when they are allowed", async () => {
    const performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
      performAndroidImmediateUpdate,
    });

    await expect(
      performNativeAppUpdate({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "started" });

    expect(performAndroidImmediateUpdate).toHaveBeenCalledTimes(1);
  });

  test("shares one Android immediate update start across concurrent requests", async () => {
    const immediateUpdateResult = createDeferred<AppUpdateResult>();
    const performAndroidImmediateUpdate = vi.fn<() => Promise<AppUpdateResult>>(
      () => immediateUpdateResult.promise,
    );
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_IN_PROGRESS,
      }),
      performAndroidImmediateUpdate,
    });

    const manualUpdate = performNativeAppUpdate({
      appUpdate: createAppUpdate(),
      nativeUpdateEnvironment,
      platform: "android",
    });
    const resumedUpdate = resumeNativeAppUpdate({
      nativeUpdateEnvironment,
      platform: "android",
    });

    await waitUntil(() => expect(performAndroidImmediateUpdate).toHaveBeenCalledTimes(1));
    immediateUpdateResult.resolve({ code: AppUpdateResultCode.OK });

    await expect(Promise.all([manualUpdate, resumedUpdate])).resolves.toStrictEqual([
      { status: "started" },
      { status: "started" },
    ]);
    expect(performAndroidImmediateUpdate).toHaveBeenCalledTimes(1);
  });

  test("maps non-OK Android immediate update results", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
      performAndroidImmediateUpdate: createPerformAndroidImmediateUpdateMock(
        AppUpdateResultCode.NOT_ALLOWED,
      ),
    });

    await expect(
      performNativeAppUpdate({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "not-allowed" });
  });

  test("returns failed when Android immediate updates reject", async () => {
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
      performAndroidImmediateUpdate: vi.fn<() => Promise<AppUpdateResult>>(() =>
        Promise.reject(new Error("Update failed")),
      ),
    });

    await expect(
      performNativeAppUpdate({
        appUpdate: createAppUpdate(),
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "failed" });
  });

  test("resumes in-progress Android immediate updates", async () => {
    const performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: false,
        updateAvailability: AppUpdateAvailability.UPDATE_IN_PROGRESS,
      }),
      performAndroidImmediateUpdate,
    });

    await expect(
      resumeNativeAppUpdate({
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "started" });

    expect(performAndroidImmediateUpdate).toHaveBeenCalledTimes(1);
  });

  test("does not resume newly available Android immediate updates", async () => {
    const performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock();
    const nativeUpdateEnvironment = createNativeUpdateEnvironment({
      appUpdateInfo: createAppUpdateInfo({
        immediateUpdateAllowed: true,
        updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE,
      }),
      performAndroidImmediateUpdate,
    });

    await expect(
      resumeNativeAppUpdate({
        nativeUpdateEnvironment,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    expect(performAndroidImmediateUpdate).not.toHaveBeenCalled();
  });

  test("opens the App Store for iOS updates", async () => {
    const openAppStore = vi.fn<AppUpdatePlugin["openAppStore"]>(() => Promise.resolve());
    const appUpdate = createAppUpdate({ openAppStore });

    await expect(
      performNativeAppUpdate({
        appUpdate,
        nativeUpdateEnvironment: createNativeUpdateEnvironment(),
        platform: "ios",
      }),
    ).resolves.toStrictEqual({ status: "started" });

    expect(openAppStore).toHaveBeenCalledWith({ appId: "6755971747" });
  });
});

function createSupportedAndroidUpdateSupport() {
  return {
    hasAvailableGooglePlayServices: true,
    hasGooglePlayServices: true,
    hasGooglePlayStore: true,
    supportsGooglePlayInAppUpdates: true,
    wasInstalledByGooglePlayStore: true,
  };
}

function createUnsupportedAndroidUpdateSupport() {
  return {
    hasAvailableGooglePlayServices: false,
    hasGooglePlayServices: false,
    hasGooglePlayStore: false,
    supportsGooglePlayInAppUpdates: false,
    wasInstalledByGooglePlayStore: false,
  };
}

function createNativeUpdateEnvironment({
  appUpdateInfo = createAppUpdateInfo(),
  getAndroidAppUpdateInfo = createGetAndroidAppUpdateInfoMock(appUpdateInfo),
  performAndroidImmediateUpdate = createPerformAndroidImmediateUpdateMock(),
  support = createSupportedAndroidUpdateSupport(),
}: {
  appUpdateInfo?: AppUpdateInfo;
  getAndroidAppUpdateInfo?: () => Promise<AppUpdateInfo>;
  performAndroidImmediateUpdate?: () => Promise<AppUpdateResult>;
  support?: {
    hasAvailableGooglePlayServices: boolean;
    hasGooglePlayServices: boolean;
    hasGooglePlayStore: boolean;
    supportsGooglePlayInAppUpdates: boolean;
    wasInstalledByGooglePlayStore: boolean;
  };
} = {}) {
  return {
    getAndroidAppUpdateInfo,
    getAndroidUpdateSupport: vi.fn<() => Promise<typeof support>>(() => Promise.resolve(support)),
    performAndroidImmediateUpdate,
  };
}

function createAppUpdateInfo(overrides: Partial<AppUpdateInfo> = {}): AppUpdateInfo {
  return {
    currentVersionCode: "1",
    currentVersionName: "1.0.0",
    immediateUpdateAllowed: false,
    updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE,
    ...overrides,
  };
}

function createGetAndroidAppUpdateInfoMock(appUpdateInfo: AppUpdateInfo = createAppUpdateInfo()) {
  return vi.fn<() => Promise<AppUpdateInfo>>(() => Promise.resolve(appUpdateInfo));
}

function createPerformAndroidImmediateUpdateMock(code = AppUpdateResultCode.OK) {
  return vi.fn<() => Promise<AppUpdateResult>>(() => Promise.resolve({ code }));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

async function waitUntil(assertion: () => void) {
  let error: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (nextError) {
      error = nextError;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw error;
}

function createAppUpdate(overrides: Partial<AppUpdatePlugin> = {}): AppUpdatePlugin {
  return {
    addListener: vi.fn<AppUpdatePlugin["addListener"]>(() =>
      Promise.resolve({ remove: () => Promise.resolve() }),
    ),
    completeFlexibleUpdate: vi.fn<AppUpdatePlugin["completeFlexibleUpdate"]>(() =>
      Promise.resolve(),
    ),
    getAppUpdateInfo: createGetAppUpdateInfoMock(),
    openAppStore: vi.fn<AppUpdatePlugin["openAppStore"]>(() => Promise.resolve()),
    performImmediateUpdate: vi.fn<AppUpdatePlugin["performImmediateUpdate"]>(() =>
      Promise.resolve({ code: AppUpdateResultCode.OK }),
    ),
    removeAllListeners: vi.fn<AppUpdatePlugin["removeAllListeners"]>(() => Promise.resolve()),
    startFlexibleUpdate: vi.fn<AppUpdatePlugin["startFlexibleUpdate"]>(() =>
      Promise.resolve({ code: AppUpdateResultCode.OK }),
    ),
    ...overrides,
  };
}

function createGetAppUpdateInfoMock() {
  return vi.fn<AppUpdatePlugin["getAppUpdateInfo"]>(() =>
    Promise.resolve({
      currentVersionCode: "1",
      currentVersionName: "1.0.0",
      immediateUpdateAllowed: false,
      updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE,
    }),
  );
}
