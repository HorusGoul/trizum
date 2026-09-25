import { describe, expect, test } from "vite-plus/test";
import { activatePartyBoostRoute, getPartyBoostRoute } from "./contracts/premium";
import {
  partyBoostErrorResponseSchema,
  partyBoostStatusSchema,
} from "../src/lib/api/premiumContract";

describe("trizum OpenAPI contract", () => {
  test("publishes the Party Boost request and response contract", () => {
    expect(getPartyBoostRoute.path).toBe("/party-boost");
    expect(getPartyBoostRoute.operationId).toBe("getPartyBoostStatus");
    expect(Object.keys(getPartyBoostRoute.responses)).toEqual(["200", "400", "401", "403", "503"]);
    expect(activatePartyBoostRoute.operationId).toBe("activatePartyBoost");
    expect(activatePartyBoostRoute.request.body.required).toBe(true);
    expect(Object.keys(activatePartyBoostRoute.responses)).toEqual([
      "200",
      "400",
      "401",
      "403",
      "409",
      "503",
    ]);
  });

  test("rejects malformed Party Boost response bodies", () => {
    expect(partyBoostStatusSchema.safeParse({ currentUser: {}, party: {} }).success).toBe(false);
    expect(
      partyBoostErrorResponseSchema.safeParse({
        error: { code: "unknown", message: "Unknown error" },
      }).success,
    ).toBe(false);
  });
});
