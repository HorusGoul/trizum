import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { describe, expect, test, vi } from "vite-plus/test";
import type { PartyBoostStatus } from "./api/premiumContract.ts";
import { createTrizumApiClient, PartyBoostApiError } from "./trizumApiClient.ts";

describe("TrizumApiClient", () => {
  test("gets Party Boost status through the typed transport", async () => {
    const partyDocumentId = createDocumentId();
    const status = createPartyBoostStatus(partyDocumentId);
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.method).toBe("GET");
      expect(new URL(request.url).pathname).toBe("/api/premium/party-boost");
      expect(new URL(request.url).searchParams.get("partyDocumentId")).toBe(partyDocumentId);
      return Response.json(status);
    });
    const client = createTestClient(fetch);

    await expect(client.premium.getPartyBoostStatus(partyDocumentId)).resolves.toEqual(status);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("activates Party Boost with a validated JSON request", async () => {
    const partyDocumentId = createDocumentId();
    const status = createPartyBoostStatus(partyDocumentId);
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.method).toBe("PUT");
      expect(request.headers.get("Content-Type")).toBe("application/json");
      await expect(request.json()).resolves.toEqual({ partyDocumentId });
      return Response.json(status);
    });
    const client = createTestClient(fetch);

    await expect(client.premium.activatePartyBoost(partyDocumentId)).resolves.toEqual(status);
  });

  test("maps typed error responses to PartyBoostApiError", async () => {
    const transferableAt = Date.now() + 60_000;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        {
          error: {
            code: "transfer_locked",
            message: "Party Boost can only move once every seven days.",
            transferableAt,
          },
        },
        { status: 409 },
      ),
    );
    const client = createTestClient(fetch);

    const request = client.premium.activatePartyBoost(createDocumentId());
    await expect(request).rejects.toMatchObject({
      code: "transfer_locked",
      transferableAt,
    });
    await expect(request).rejects.toBeInstanceOf(PartyBoostApiError);
  });

  test("rejects malformed successful responses", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ isPremium: true }));
    const client = createTestClient(fetch);

    await expect(client.premium.getPartyBoostStatus(createDocumentId())).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});

function createTestClient(fetch: typeof globalThis.fetch) {
  return createTrizumApiClient({
    baseUrl: () => "https://trizum.app",
    fetch,
  });
}

function createDocumentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function createPartyBoostStatus(partyDocumentId: string): PartyBoostStatus {
  return {
    currentUser: {
      assignment: {
        active: true,
        assignedAt: 1,
        partyDocumentId,
        revocationReason: null,
        revokedAt: null,
        transferableAt: 2,
      },
      isPremium: true,
    },
    party: {
      isBoosted: true,
      isBoostedByCurrentUser: true,
    },
  };
}
