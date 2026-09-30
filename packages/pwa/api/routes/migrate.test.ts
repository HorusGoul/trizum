import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  migrationDataSchema,
  migrationErrorResponseSchema,
} from "../../src/lib/api/migrationContract";
import { apiMigrateRoute } from "./migrate";

describe("Tricount migration contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  test.each(["/", "/?key="])(
    "preserves the plain-text missing-key response for %s",
    async (path) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      vi.stubGlobal("fetch", fetch);
      const response = await apiMigrateRoute.request(path);
      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
      await expect(response.text()).resolves.toBe("Missing 'key' query parameter");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("returns validated migration data without requiring a trizum session", async () => {
    stubUpstream({
      Response: [
        {
          Registry: {
            title: "Trip",
            description: null,
            currency: "EUR",
            memberships: [
              { RegistryMembershipNonUser: { id: 1, alias: { display_name: "Alice" } } },
            ],
            all_registry_entry: [],
          },
        },
      ],
    });
    const response = await apiMigrateRoute.request("/?key=test-key");
    expect(response.status).toBe(200);
    const data = migrationDataSchema.parse(await response.json());
    expect(data.party.name).toBe("Trip");
    expect(data.party.participants).toEqual({ TCM_1: { id: "TCM_1", name: "Alice" } });
    expect(data.expenses).toEqual([]);
    expect(data.photos).toEqual([]);
  });

  test("preserves upstream failure status and error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503, statusText: "Unavailable" })),
    );
    const response = await apiMigrateRoute.request("/?key=test-key");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication failed: 503 Unavailable",
      data: null,
    });
  });

  test("does not return malformed converted data as a successful import", async () => {
    const upstream = {
      Response: [
        {
          Registry: {
            title: "Trip",
            description: "",
            currency: "invalid",
            memberships: [],
            all_registry_entry: [],
          },
        },
      ],
    };
    stubUpstream(upstream);
    const response = await apiMigrateRoute.request("/?key=test-key");
    expect(response.status).toBe(500);
    const error = migrationErrorResponseSchema.parse(await response.json());
    expect(error.data).toEqual(upstream);
  });

  test("preserves opaque upstream diagnostics even when the upstream returns a scalar", async () => {
    stubUpstream(123);
    const response = await apiMigrateRoute.request("/?key=test-key");
    expect(response.status).toBe(500);
    expect(migrationErrorResponseSchema.parse(await response.json()).data).toBe(123);
  });
});

function stubUpstream(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (new Request(input).url.endsWith("/session-registry-installation")) {
        return Response.json({
          Response: [{ Token: { token: "test-token" } }, { UserPerson: { id: 1 } }],
        });
      }
      return Response.json(data);
    }),
  );
}
