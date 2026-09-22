import { describe, expect, it } from "vite-plus/test";
import { PremiumVerificationUnavailableError, verifyRevenueCatPremium } from "./revenueCat";

const NOW = Date.UTC(2026, 8, 22);

describe("verifyRevenueCatPremium", () => {
  it("accepts a non-expiring entitlement", async () => {
    const result = await verifyRevenueCatPremium({
      apiKey: "secret",
      fetcher: createFetcher({ expires_date: null }),
      now: NOW,
      userId: "person",
    });

    expect(result).toEqual({ expiresAt: null, isPremium: true });
  });

  it("accepts an entitlement that expires in the future", async () => {
    const expiresAt = NOW + 60_000;
    const result = await verifyRevenueCatPremium({
      apiKey: "secret",
      fetcher: createFetcher({ expires_date: new Date(expiresAt).toISOString() }),
      now: NOW,
      userId: "person",
    });

    expect(result).toEqual({ expiresAt, isPremium: true });
  });

  it("rejects an expired entitlement", async () => {
    const result = await verifyRevenueCatPremium({
      apiKey: "secret",
      fetcher: createFetcher({ expires_date: new Date(NOW - 1).toISOString() }),
      now: NOW,
      userId: "person",
    });

    expect(result.isPremium).toBe(false);
  });

  it("treats a missing subscriber as inactive", async () => {
    const result = await verifyRevenueCatPremium({
      apiKey: "secret",
      fetcher: async () => new Response(null, { status: 404 }),
      now: NOW,
      userId: "person",
    });

    expect(result).toEqual({ expiresAt: null, isPremium: false });
  });

  it("does not interpret an upstream failure as an inactive entitlement", async () => {
    await expect(
      verifyRevenueCatPremium({
        apiKey: "secret",
        fetcher: async () => new Response(null, { status: 503 }),
        now: NOW,
        userId: "person",
      }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);
  });

  it("requires the secret API key", async () => {
    await expect(
      verifyRevenueCatPremium({ apiKey: undefined, now: NOW, userId: "person" }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);
  });
});

function createFetcher(entitlement: { expires_date: string | null }): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        subscriber: {
          entitlements: {
            premium: entitlement,
          },
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
}
