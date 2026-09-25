import type { PremiumOffering } from "./premiumCommerce.ts";

export type PremiumPaywallLoadState =
  | { loadKey: string; status: "loading" }
  | { loadKey: string; offering: PremiumOffering; status: "ready" }
  | { loadKey: string; status: "error" };

export function createPremiumPaywallLoadKey(sessionId: number, userId: string | null) {
  return `${sessionId}:${userId ?? "signed-out"}`;
}

export function getCurrentPremiumPaywallLoadState(
  loadState: PremiumPaywallLoadState,
  loadKey: string,
): PremiumPaywallLoadState {
  if (loadState.loadKey === loadKey) {
    return loadState;
  }

  return { loadKey, status: "loading" };
}
