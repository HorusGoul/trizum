import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PartyBoostApiError } from "./partyBoostApi.ts";
import { activatePartyBoost, fetchPartyBoostStatus } from "./partyBoostApi.ts";

const transport = vi.hoisted(() => ({
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock("#src/lib/auth-client.ts", () => ({
  getAuthBaseURL: () => "https://trizum.test",
}));

vi.mock("#src/lib/nativeAuthSession.ts", () => ({
  fetchWithNativeAuth: transport.fetch,
}));

describe("Party Boost API client", () => {
  beforeEach(() => {
    transport.fetch.mockReset();
  });

  it("requests and validates Party Boost status", async () => {
    const status = createStatus();
    transport.fetch.mockResolvedValue(jsonResponse(status));

    await expect(fetchPartyBoostStatus("party-1")).resolves.toEqual(status);

    const [url, init] = transport.fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://trizum.test/api/premium/party-boost?partyDocumentId=party-1",
    );
    expect(init).toEqual({ method: "GET" });
  });

  it("sends activation as JSON and validates the response", async () => {
    const status = createStatus();
    transport.fetch.mockResolvedValue(jsonResponse(status));

    await expect(activatePartyBoost("party-1")).resolves.toEqual(status);

    const [url, init] = transport.fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://trizum.test/api/premium/party-boost");
    expect(init).toEqual({
      body: JSON.stringify({ partyDocumentId: "party-1" }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
  });

  it("preserves typed server errors", async () => {
    transport.fetch.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "unauthorized",
            message: "Sign in is required.",
          },
        },
        401,
      ),
    );

    await expect(fetchPartyBoostStatus("party-1")).rejects.toMatchObject({
      code: "unauthorized",
      message: "Sign in is required.",
    });
  });

  it("rejects a successful response that does not match the public contract", async () => {
    transport.fetch.mockResolvedValue(jsonResponse({ currentUser: {}, party: {} }));

    await expect(fetchPartyBoostStatus("party-1")).rejects.toEqual(
      expect.objectContaining<Partial<PartyBoostApiError>>({ code: "unavailable" }),
    );
  });
});

function createStatus() {
  return {
    currentUser: { assignment: null, isPremium: false },
    party: { isBoosted: false, isBoostedByCurrentUser: false },
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
