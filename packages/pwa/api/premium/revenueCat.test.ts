import { describe, expect, it } from "vite-plus/test";
import { PremiumVerificationUnavailableError, verifyRevenueCatPremium } from "./revenueCat";

describe("verifyRevenueCatPremium", () => {
  it("verifies only production RevenueCat resources", async () => {
    const requests: Request[] = [];
    const result = await verifyRevenueCatPremium({
      apiKey: "secret",
      fetcher: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return Response.json({ items: [], next_page: null, object: "list", url: request.url });
      },
      projectId: "project",
      userId: "person",
    });

    expect(result).toEqual({ isPremium: false });
    expect(requests).toHaveLength(2);
    expect(
      requests.every(
        (request) => new URL(request.url).searchParams.get("environment") === "production",
      ),
    ).toBe(true);
  });

  it("requires the RevenueCat v2 secret API key and project ID", async () => {
    await expect(
      verifyRevenueCatPremium({ apiKey: undefined, projectId: "project", userId: "person" }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);

    await expect(
      verifyRevenueCatPremium({ apiKey: "secret", projectId: undefined, userId: "person" }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);
  });

  it.each([undefined, "", "other", "person-extra", "*", " person "])(
    "does not query sandbox without an exact configured account match (%s)",
    async (sandboxUserId) => {
      const environments: Array<string | null> = [];
      await verifyRevenueCatPremium({
        apiKey: "secret",
        projectId: "project",
        sandboxUserId,
        userId: "person",
        fetcher: async (input) => {
          const url = new URL(input instanceof Request ? input.url : String(input));
          environments.push(url.searchParams.get("environment"));
          return Response.json({ items: [], next_page: null, object: "list", url: url.pathname });
        },
      });
      expect(environments).toEqual(["production", "production"]);
    },
  );

  it("does not fall back to sandbox when production verification fails", async () => {
    const environments: Array<string | null> = [];
    await expect(
      verifyRevenueCatPremium({
        apiKey: "secret",
        projectId: "project",
        sandboxUserId: "person",
        userId: "person",
        fetcher: async (input) => {
          const url = new URL(input instanceof Request ? input.url : String(input));
          environments.push(url.searchParams.get("environment"));
          return Response.json({ object: "error" }, { status: 503 });
        },
      }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);
    expect(environments).toEqual(["production", "production"]);
  });
});
