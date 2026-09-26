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

  it.each(["ios", "android"] as const)(
    "does not reuse a previously resolved %s entitlement during pending or failed authentication",
    (platform) => {
      const resolvedState = {
        hasActiveSubscription: true,
        status: "premium" as const,
        userId: "account-a",
      };
      expect(
        getCurrentPremiumState({
          isSessionPending: true,
          platform,
          resolvedState,
          userId: "account-a",
        }),
      ).toEqual({ hasActiveSubscription: false, status: "loading" });
      expect(
        getCurrentPremiumState({
          hasSessionError: true,
          isSessionPending: false,
          platform,
          resolvedState,
          userId: "account-a",
        }),
      ).toEqual({ hasActiveSubscription: false, status: "error" });
    },
  );

  it("only recovers a resolved entitlement for the verified account after reconnect", () => {
    const resolvedState = {
      hasActiveSubscription: true,
      status: "premium" as const,
      userId: "account-a",
    };
    expect(
      getCurrentPremiumState({
        isSessionPending: false,
        platform: "android",
        resolvedState,
        userId: "account-a",
      }),
    ).toEqual(resolvedState);
    expect(
      getCurrentPremiumState({
        isSessionPending: false,
        platform: "android",
        resolvedState,
        userId: "account-b",
      }),
    ).toEqual({ hasActiveSubscription: false, status: "loading" });
    expect(
      getCurrentPremiumState({
        isSessionPending: false,
        platform: "android",
        resolvedState,
        userId: null,
      }),
    ).toEqual({ hasActiveSubscription: false, status: "free" });
  });
});
