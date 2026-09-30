import { Capacitor } from "@capacitor/core";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { ZodError } from "zod";
import { fetchWithNativeAuth, getNativeAuthToken, setNativeAuthToken } from "./nativeAuthSession";
import {
  CloudSyncApiError,
  createTrizumApiClient,
  MigrationApiError,
  trizumApiClient,
} from "./trizumApiClient";
import type { MigrationData } from "../models/migrationData";

const migrationData: MigrationData = {
  party: {
    type: "party",
    name: "Trip",
    currency: "EUR",
    description: "",
    participants: { alice: { id: "alice", name: "Alice" } },
  },
  expenses: [
    {
      name: "Lunch",
      paidAt: "2026-09-01T12:00:00.000Z",
      paidBy: { alice: 1000 },
      shares: { alice: { type: "exact", value: 1000 } },
      photos: [],
    },
  ],
  photos: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cloud Sync client", () => {
  test("reads and saves settings with the native authenticated transport", async () => {
    const storage = new Map<string, string>();
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    setNativeAuthToken("old-token");
    const settings = { partyListDocumentId: documentId(), updatedAt: 123 };
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        expect(request.credentials).toBe("include");
        expect(request.headers.get("Authorization")).toBe(
          requests.length ? "Bearer new-token" : "Bearer old-token",
        );
        expect(request.url).toBe("https://trizum.test/api/cloud-sync/settings");
        requests.push(request);
        return Response.json({ settings }, { headers: { "set-auth-token": "new-token" } });
      }),
    );
    const client = createClient(fetchWithNativeAuth);
    await expect(client.cloudSync.getSettings()).resolves.toEqual({ settings });
    await expect(
      client.cloudSync.saveSettings({ partyListDocumentId: settings.partyListDocumentId }),
    ).resolves.toEqual({ settings });
    expect(requests.map((request) => request.method)).toEqual(["GET", "PUT"]);
    await expect(requests[1].json()).resolves.toEqual({
      partyListDocumentId: settings.partyListDocumentId,
    });
    expect(getNativeAuthToken()).toBe("new-token");
  });

  test("allows missing settings on GET but rejects them on PUT", async () => {
    const client = createClient(async () => Response.json({ settings: null }));
    await expect(client.cloudSync.getSettings()).resolves.toEqual({ settings: null });
    await expect(
      client.cloudSync.saveSettings({ partyListDocumentId: documentId() }),
    ).rejects.toMatchObject({ status: "invalid_response" });
  });

  test.each([400, 401, 409, 500])("types a %s error with its server message", async (status) => {
    const client = createClient(async () => Response.json({ error: "Server message" }, { status }));
    const promise = client.cloudSync.saveSettings({ partyListDocumentId: documentId() });
    await expect(promise).rejects.toBeInstanceOf(CloudSyncApiError);
    await expect(promise).rejects.toMatchObject({ status, message: "Server message" });
  });

  test.each([
    { status: 200, body: {} },
    { status: 200, body: { settings: { partyListDocumentId: "invalid", updatedAt: 1 } } },
    {
      status: 200,
      body: { settings: { partyListDocumentId: documentId(), updatedAt: "yesterday" } },
    },
    { status: 500, body: { error: 123 } },
    { status: 418, body: { error: "Unexpected status" } },
  ])("rejects malformed Cloud Sync responses: $status $body", async ({ status, body }) => {
    const client = createClient(async () => Response.json(body, { status }));
    await expect(client.cloudSync.getSettings()).rejects.toMatchObject({
      status: "invalid_response",
    });
  });

  test("rejects invalid input before making a request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = createClient(fetch);
    await expect(
      client.cloudSync.saveSettings({
        partyListDocumentId: "invalid" as ReturnType<typeof documentId>,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Tricount migration client", () => {
  test("keeps public migration requests free of native credentials", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.stubGlobal("window", { location: { origin: "capacitor://localhost" } });
    vi.stubGlobal("localStorage", { getItem: () => "native-token" });
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.credentials).toBe("same-origin");
      expect(request.headers.has("Authorization")).toBe(false);
      return Response.json(migrationData);
    });
    vi.stubGlobal("fetch", fetch);
    await expect(trizumApiClient.migration.importTricount("test-key")).resolves.toEqual(
      migrationData,
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("validates imports and encodes keys on the existing migration host", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        expect(request.method).toBe("GET");
        expect(url.origin).toBe("https://preview.trizum.test");
        expect(url.pathname).toBe("/api/migrate");
        expect(url.searchParams.get("key")).toBe("a+b&c");
        return Response.json(migrationData);
      },
    );
    const client = createTrizumApiClient({
      baseUrl: () => "https://trizum.test",
      migrationBaseUrl: () => "https://preview.trizum.test",
      fetch,
    });
    await expect(client.migration.importTricount("a+b&c")).resolves.toEqual(migrationData);
  });

  test("types the legacy plain-text validation error", async () => {
    const client = createClient(
      async () => new Response("Missing 'key' query parameter", { status: 400 }),
    );
    const promise = client.migration.importTricount("test-key");
    await expect(promise).rejects.toBeInstanceOf(MigrationApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: "Missing 'key' query parameter",
    });
  });

  test("types server errors and preserves their messages", async () => {
    const client = createClient(async () =>
      Response.json({ error: "Upstream unavailable", data: null }, { status: 500 }),
    );
    await expect(client.migration.importTricount("test-key")).rejects.toMatchObject({
      status: 500,
      message: "Upstream unavailable",
    });
  });

  test.each([
    {},
    { ...migrationData, party: { ...migrationData.party, currency: "invalid" } },
    { ...migrationData, expenses: [{ ...migrationData.expenses[0], paidBy: { alice: "10.00" } }] },
    {
      ...migrationData,
      expenses: [
        { ...migrationData.expenses[0], shares: { alice: { type: "unknown", value: 10 } } },
      ],
    },
  ])("rejects malformed import payloads before creating local documents", async (body) => {
    const client = createClient(async () => Response.json(body));
    await expect(client.migration.importTricount("test-key")).rejects.toMatchObject({
      status: "invalid_response",
    });
  });

  test("rejects missing keys before fetching", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(createClient(fetch).migration.importTricount("")).rejects.toBeInstanceOf(ZodError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

test.each([200, 500])("both clients reject non-JSON responses (%s)", async (status) => {
  const client = createClient(async () => new Response("<html>Unavailable</html>", { status }));
  await expect(client.cloudSync.getSettings()).rejects.toMatchObject({
    status: "invalid_response",
  });
  await expect(client.migration.importTricount("test-key")).rejects.toMatchObject({
    status: "invalid_response",
  });
});

function documentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function createClient(fetch: typeof globalThis.fetch) {
  return createTrizumApiClient({ baseUrl: () => "https://trizum.test", fetch });
}
