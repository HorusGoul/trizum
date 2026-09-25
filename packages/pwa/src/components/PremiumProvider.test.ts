import { describe, expect, it } from "vite-plus/test";
import { getCurrentPremiumState } from "./premiumProviderState.ts";

describe("getCurrentPremiumState", () => {
  it("keeps advertising suppressed when authentication could not be resolved", () => {
    expect(
      getCurrentPremiumState({
        hasSessionError: true,
        isSessionPending: false,
        platform: "ios",
        resolvedState: null,
        userId: null,
      }),
    ).toEqual({ hasActiveSubscription: false, status: "error" });
  });
});
