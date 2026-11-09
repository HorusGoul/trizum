import { describe, expect, test } from "vite-plus/test";
import {
  partyBoostErrorResponseSchema,
  partyBoostStatusSchema,
} from "../src/lib/api/premiumContract";
import app from "./worker";

describe("trizum OpenAPI contract", () => {
  test("publishes the assembled first-party operations", async () => {
    const response = await app.request("https://trizum.test/api/openapi.json");

    // SAFETY: This JSON comes from the in-process OpenAPI endpoint; the assertions below verify the generated paths and responses.
    const document = (await response.json()) as {
      paths?: Record<
        string,
        Record<
          string,
          {
            operationId?: string;
            requestBody?: { required?: boolean };
            responses?: Record<string, { description?: string }>;
          }
        >
      >;
    };

    expect(response.status).toBe(200);
    const partyBoostPath = document.paths?.["/api/premium/party-boost"];
    expect(partyBoostPath?.get?.operationId).toBe("getPartyBoostStatus");
    expect(Object.keys(partyBoostPath?.get?.responses ?? {})).toEqual([
      "200",
      "400",
      "401",
      "403",
      "503",
    ]);
    expect(partyBoostPath?.put?.operationId).toBe("activatePartyBoost");
    expect(partyBoostPath?.put?.requestBody?.required).toBe(true);
    expect(Object.keys(partyBoostPath?.put?.responses ?? {})).toEqual([
      "200",
      "400",
      "401",
      "403",
      "409",
      "503",
    ]);

    const cloudSync = document.paths?.["/api/cloud-sync/settings"];
    expect(cloudSync?.get?.operationId).toBe("getCloudUserSettings");
    expect(Object.keys(cloudSync?.get?.responses ?? {})).toEqual(["200", "401", "500"]);
    expect(cloudSync?.put?.operationId).toBe("saveCloudUserSettings");
    expect(cloudSync?.put?.requestBody?.required).toBe(true);
    expect(Object.keys(cloudSync?.put?.responses ?? {})).toEqual([
      "200",
      "400",
      "401",
      "409",
      "500",
    ]);

    const migration = document.paths?.["/api/migrate"];
    expect(migration?.get?.operationId).toBe("migrateTricount");
    expect(Object.keys(migration?.get?.responses ?? {})).toEqual(["200", "400", "500"]);
    const receipts = document.paths?.["/api/premium/receipts"];
    expect(receipts?.post?.operationId).toBe("analyzeReceipt");
    expect(receipts?.post?.requestBody?.required).toBe(true);
    expect(Object.keys(receipts?.post?.responses ?? {})).toEqual([
      "200",
      "400",
      "401",
      "403",
      "413",
      "429",
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
