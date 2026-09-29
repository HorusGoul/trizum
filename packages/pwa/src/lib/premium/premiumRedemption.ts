import type { RevenueCatPlatform } from "./revenueCatConfig.ts";

export const APPLE_APP_ID = "6755971747";
const PENDING_REDEMPTION_KEY = "trizum:pending-premium-redemption:v1";
const REDEMPTION_SYNC_WINDOW_MS = 15 * 60_000;

export function parseRedemptionSearch(search: Record<string, unknown>) {
  return { code: typeof search.code === "string" ? search.code.trim().slice(0, 128) : "" };
}

export function detectRedemptionPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): RevenueCatPlatform | undefined {
  if (/android/i.test(userAgent)) return "android";
  // iPadOS can request desktop sites and identify as a Mac.
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1))
    return "ios";
  return undefined;
}

export function getStoreRedemptionUrl(platform: RevenueCatPlatform, code: string) {
  const url = new URL(
    platform === "ios" ? "https://apps.apple.com/redeem" : "https://play.google.com/redeem",
  );
  if (platform === "ios") {
    url.searchParams.set("ctx", "offercodes");
    url.searchParams.set("id", APPLE_APP_ID);
  }
  if (code.trim()) {
    url.searchParams.set("code", code.trim());
  }
  return url.toString();
}

// Keep only account + expiry, never the code. This survives a process restart while in the store.
export function rememberPremiumRedemption(userId: string) {
  localStorage.setItem(
    PENDING_REDEMPTION_KEY,
    JSON.stringify({ userId, expiresAt: Date.now() + REDEMPTION_SYNC_WINDOW_MS }),
  );
}

export function hasPendingPremiumRedemption(userId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_REDEMPTION_KEY) ?? "null");
    return (
      value?.userId === userId &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export function finishPremiumRedemption(userId: string) {
  if (hasPendingPremiumRedemption(userId)) {
    localStorage.removeItem(PENDING_REDEMPTION_KEY);
  }
}
