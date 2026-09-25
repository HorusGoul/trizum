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
});
