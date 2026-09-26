import { describe, expect, it } from "vite-plus/test";
import {
  getCurrentPremiumState,
  getPremiumStateAfterRefreshError,
} from "./premiumProviderState.ts";

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

  it("uses the SDK entitlement for the remembered account and never for a different account", () => {
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

describe("Premium refresh failures", () => {
  it.each(["premium", "free"] as const)(
    "preserves known %s access for the same account",
    (status) => {
      const previous = { userId: "account-a", status, hasActiveSubscription: status === "premium" };
      expect(getPremiumStateAfterRefreshError(previous, "account-a")).toBe(previous);
    },
  );

  it("does not reuse a previous account's entitlement or invent one on initial failure", () => {
    const previous = {
      userId: "account-a",
      status: "premium" as const,
      hasActiveSubscription: true,
    };
    for (const state of [previous, null]) {
      expect(getPremiumStateAfterRefreshError(state, "account-b")).toEqual({
        userId: "account-b",
        status: "error",
        hasActiveSubscription: false,
      });
    }
  });
});
