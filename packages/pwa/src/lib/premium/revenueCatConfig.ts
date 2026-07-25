import { Capacitor } from "@capacitor/core";

const REVENUECAT_PUBLIC_API_KEYS = {
  android: "goog_iyJtGtWRAfZUuBLsAhcFKnAnVhm",
  ios: "appl_GPBzkvGuJSyKEavgYoIOlNtvZRp",
  test: "test_itMiWJCYZkoiozdYADIKBzBfFua",
} as const;

export type RevenueCatPlatform = "android" | "ios";

export function getRevenueCatPlatform(): RevenueCatPlatform | undefined {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : undefined;
}

export function getRevenueCatPublicApiKey(platform: RevenueCatPlatform) {
  return import.meta.env.VITE_APP_REVENUECAT_TEST_STORE === "true"
    ? REVENUECAT_PUBLIC_API_KEYS.test
    : REVENUECAT_PUBLIC_API_KEYS[platform];
}
