export const APPLE_APP_ID = "6755971747";

export type MobilePlatform = "android" | "ios";

export function detectMobilePlatform(
  userAgent: string,
  maxTouchPoints = 0,
): MobilePlatform | undefined {
  if (/android/i.test(userAgent)) return "android";

  // iPadOS can request desktop sites and identify as a Mac.
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1))
    return "ios";

  return undefined;
}

export function getAppStoreUrl(platform: MobilePlatform) {
  return platform === "ios"
    ? `https://apps.apple.com/app/trizum/id${APPLE_APP_ID}`
    : "https://play.google.com/store/apps/details?id=app.trizum.capacitor";
}
