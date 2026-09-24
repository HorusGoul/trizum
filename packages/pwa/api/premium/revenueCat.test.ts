import { describe, expect, it } from "vite-plus/test";
import { PremiumVerificationUnavailableError, verifyRevenueCatPremium } from "./revenueCat";

describe("verifyRevenueCatPremium", () => {
  it("requires the RevenueCat v2 secret API key and project ID", async () => {
    await expect(
      verifyRevenueCatPremium({ apiKey: undefined, projectId: "project", userId: "person" }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);

    await expect(
      verifyRevenueCatPremium({ apiKey: "secret", projectId: undefined, userId: "person" }),
    ).rejects.toBeInstanceOf(PremiumVerificationUnavailableError);
  });
});
