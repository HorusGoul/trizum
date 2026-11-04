import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { ApiEnv } from "../env";
import { createCloudSyncRoute, type CloudSettingsStore } from "./cloud-sync";

interface TestCloudSettings {
  partyListDocumentId: string;
  updatedAt: number;
}

const getSession =
  vi.fn<(input: { headers: Headers }) => Promise<{ user: { id: string } } | null>>();

const select = vi.fn<CloudSettingsStore["read"]>();
const insert = vi.fn<CloudSettingsStore["insertIfMissing"]>();

const cloudSyncRoute = createCloudSyncRoute({
  authenticate: async (_env, _context, request) =>
    (await getSession({ headers: request.headers }))?.user.id ?? null,
  settingsStore: () => ({ read: select, insertIfMissing: insert }),
});

describe("Cloud Sync contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSession.mockResolvedValue({ user: { id: "test-user" } });
    select.mockResolvedValue(undefined);
  });

  test.each(["GET", "PUT"] as const)(
    "requires authentication before validating %s",
    async (method) => {
      getSession.mockResolvedValue(null);
      const response = await request(method, "{");
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
      expect(select).not.toHaveBeenCalled();
    },
  );

  test("reads unset and configured settings and forwards native auth headers", async () => {
    const empty = await request("GET");
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toEqual({ settings: null });
    const settings = { partyListDocumentId: documentId(), updatedAt: 123 };
    select.mockResolvedValue(settings);
    const response = await request("GET");
    await expect(response.json()).resolves.toEqual({ settings });
    expect(getSession.mock.lastCall?.[0].headers.get("Authorization")).toBe("Bearer test-token");
  });

  test.each([
    ["{", "Expected a settings object."],
    ["null", "Expected a settings object."],
    ['"value"', "Expected a settings object."],
    ["{}", "Party list document ID is invalid."],
    ['{"partyListDocumentId":"invalid"}', "Party list document ID is invalid."],
  ])("rejects invalid settings %s with the existing error", async (body, error) => {
    const response = await request("PUT", body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
    expect(insert).not.toHaveBeenCalled();
  });

  test("saves settings and preserves JSON requests without a JSON content type", async () => {
    const settings = { partyListDocumentId: documentId(), updatedAt: 123 };
    select.mockResolvedValueOnce(undefined).mockResolvedValueOnce(settings);
    const response = await request("PUT", JSON.stringify(settings), "text/plain");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ settings });
    expect(insert).toHaveBeenCalledWith({
      partyListDocumentId: settings.partyListDocumentId,
      updatedAt: expect.any(Number),
      userId: "test-user",
    });
    expect(insert).toHaveBeenCalledOnce();
  });

  test("repeated setup keeps the original timestamp and does not write", async () => {
    const settings = { partyListDocumentId: documentId(), updatedAt: 123 };
    select.mockResolvedValue(settings);

    const response = await request(
      "PUT",
      JSON.stringify({ partyListDocumentId: settings.partyListDocumentId }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ settings });
    expect(insert).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    "rejects a different document, including an insert race (%s)",
    async (race) => {
      const existing = { partyListDocumentId: documentId(), updatedAt: 123 };

      if (race) select.mockResolvedValueOnce(undefined);
      select.mockResolvedValue(existing);
      const response = await request("PUT", JSON.stringify({ partyListDocumentId: documentId() }));
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "trizum cloud is already set up for this account.",
      });
    },
  );

  test("returns the existing server error when an insert cannot be read back", async () => {
    const response = await request("PUT", JSON.stringify({ partyListDocumentId: documentId() }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not save trizum cloud settings.",
    });
  });

  test.each(["GET", "PUT"] as const)("types unexpected database errors for %s", async (method) => {
    select.mockRejectedValue(new Error("Database unavailable"));
    const response = await request(method, JSON.stringify({ partyListDocumentId: documentId() }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error:
        method === "GET"
          ? "Failed to load trizum cloud settings."
          : "Could not save trizum cloud settings.",
    });
  });

  test("does not return malformed stored settings as a success", async () => {
    select.mockResolvedValue({ partyListDocumentId: "invalid", updatedAt: 1 });
    expect((await request("GET")).status).toBe(500);
  });
});

function documentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function request(method: "GET" | "PUT", body?: string, contentType = "application/json") {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": contentType, Authorization: "Bearer test-token" },
  };

  if (method === "PUT") init.body = body;

  // SAFETY: The explicit authentication and settings ports supply the bindings this route reads.
  return cloudSyncRoute.fetch(new Request("https://trizum.test/settings", init), {} as ApiEnv, {
    waitUntil: vi.fn<ExecutionContext["waitUntil"]>(),
    passThroughOnException: vi.fn<ExecutionContext["passThroughOnException"]>(),
    props: {},
  });
}
