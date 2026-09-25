import { describe, expect, it } from "vite-plus/test";
import {
  createPremiumPaywallLoadKey,
  getCurrentPremiumPaywallLoadState,
  type PremiumPaywallLoadState,
} from "./premiumPaywallState.ts";

describe("getCurrentPremiumPaywallLoadState", () => {
  it("hides a previous offering when the paywall is reopened", () => {
    const previousLoadKey = createPremiumPaywallLoadKey(1, "user-1");
    const nextLoadKey = createPremiumPaywallLoadKey(2, "user-1");
    const previousState = {
      loadKey: previousLoadKey,
      offering: {
        defaultPlanId: "monthly",
        plans: [],
      },
      status: "ready",
    } satisfies PremiumPaywallLoadState;

    expect(getCurrentPremiumPaywallLoadState(previousState, nextLoadKey)).toEqual({
      loadKey: nextLoadKey,
      status: "loading",
    });
  });

  it("hides an offering loaded for a different account", () => {
    const previousState = {
      loadKey: createPremiumPaywallLoadKey(1, "user-1"),
      offering: {
        defaultPlanId: "monthly",
        plans: [],
      },
      status: "ready",
    } satisfies PremiumPaywallLoadState;
    const nextLoadKey = createPremiumPaywallLoadKey(1, "user-2");

    expect(getCurrentPremiumPaywallLoadState(previousState, nextLoadKey).status).toBe("loading");
  });
});
