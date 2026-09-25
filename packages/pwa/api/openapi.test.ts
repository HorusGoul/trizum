import { describe, expect, test, vi } from "vite-plus/test";
import {
  partyBoostErrorResponseSchema,
  partyBoostStatusSchema,
} from "../src/lib/api/premiumContract";
import app from "./worker";

vi.mock("cloudflare:email", () => ({
  EmailMessage: class EmailMessage {},
}));
vi.mock("./i18n", () => ({
  createApiI18nMiddleware: () => async (_context: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("./routes/party-share-preview", async () => {
  const { Hono } = await import("hono");
  return { partySharePreviewRoute: new Hono() };
});

describe("trizum OpenAPI contract", () => {
  test("publishes the assembled Party Boost operations", async () => {
    const response = await app.request("https://trizum.test/api/openapi.json");
    const document = (await response.json()) as {
      paths?: Record<
        string,
        Record<
          string,
          {
            operationId?: string;
            requestBody?: { required?: boolean };
            responses?: Record<string, unknown>;
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
