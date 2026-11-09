import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPartyBoostTestHarness } from "../premium/partyBoostTestHarness";
import type { ReceiptAI } from "../premium/receiptExtraction";

const image = "data:image/jpeg;base64,/9j/AA==";

const receipt = {
  merchantName: "Corner shop",
  total: "12.34",
  currency: "EUR",
  items: [{ name: "Apples", quantity: "0,750 kg", unitPrice: "2.490", lineTotal: "1.87" }],
};

describe("receipt analysis authorization and contract", () => {
  let harness: Awaited<ReturnType<typeof createPartyBoostTestHarness>>;
  const run = vi.fn<ReceiptAI["run"]>();
  const limit = vi.fn<RateLimit["limit"]>();
  beforeEach(async () => {
    harness = await createPartyBoostTestHarness();
    run.mockReset().mockResolvedValue(completion(JSON.stringify(receipt)));
    limit.mockReset().mockResolvedValue({ success: true });
    harness.env.AI = { run };
    harness.env.RECEIPT_RATE_LIMITER = { limit };
  }, 30_000);
  afterEach(async () => {
    await harness.dispose();
  });

  async function boostedParty() {
    const partyId = harness.createParty();
    const owner = await harness.createUser();
    owner.join(partyId);
    harness.customers.set(owner.id, "subscription");
    expect((await harness.request("PUT", partyId, owner.cookie)).status).toBe(200);

    return { partyId, owner };
  }

  test("requires sign-in before invoking AI", async () => {
    expect((await harness.requestReceipt(harness.createParty(), image)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  test("requires party membership and a server-verified Boost", async () => {
    const user = await harness.createUser();
    const partyId = harness.createParty();
    expect((await harness.requestReceipt(partyId, image, user.cookie)).status).toBe(403);
    user.join(partyId);
    // A client-edited shared cache cannot authorize an expensive server call.
    harness.documents.get(partyId)!.boost = {
      forged: {
        boostId: "forged",
        participantId: user.participantId,
        boostedAt: new Date().toISOString(),
        checkedAt: new Date().toISOString(),
      },
    };
    const response = await harness.requestReceipt(partyId, image, user.cookie);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "boost_required" } });
    expect(run).not.toHaveBeenCalled();
  });
  test("lets a non-Premium member use another member's active Boost", async () => {
    const { partyId } = await boostedParty();
    const member = await harness.createUser();
    member.join(partyId);
    const response = await harness.requestReceipt(partyId, image, member.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(receipt);
    expect(run).toHaveBeenCalledOnce();
  });
  test("preserves multilingual receipt fields from Gemma chat completions", async () => {
    const { partyId, owner } = await boostedParty();

    const multilingualReceipt = {
      merchantName: "東京マーケット / سوق",
      total: "12.34",
      currency: "JPY",
      items: [
        { name: "りんご / تفاح", quantity: "0,750 kg", unitPrice: "2.490", lineTotal: "1.87" },
      ],
    };

    run.mockResolvedValue(completion(JSON.stringify(multilingualReceipt)));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(multilingualReceipt);
    expect(run).toHaveBeenCalledWith(
      "@cf/google/gemma-4-26b-a4b-it",
      expect.objectContaining({
        messages: expect.arrayContaining([
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: image, detail: "high" } }],
          },
        ]),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt",
            strict: true,
            schema: expect.objectContaining({ type: "object" }),
          },
        },
        max_completion_tokens: 8192,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
        store: false,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  test.each(["length", "content_filter", "tool_calls"])(
    "rejects a Gemma completion stopped by %s",
    async (finishReason) => {
      const { partyId, owner } = await boostedParty();
      run.mockResolvedValue(completion(JSON.stringify(receipt), finishReason));
      const response = await harness.requestReceipt(partyId, image, owner.cookie);
      expect(response.status).toBe(503);
    },
  );
  test("rejects refusals without exposing provider content", async () => {
    const { partyId, owner } = await boostedParty();
    run.mockResolvedValue({
      choices: [
        { finish_reason: "stop", message: { content: null, refusal: "Private provider response" } },
      ],
    });
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unavailable", message: "Receipt analysis could not be completed." },
    });
  });
  test.each(["inactive", "owner_left", "transferred", "verification_unavailable"])(
    "denies AI when Boost is %s",
    async (state) => {
      const { partyId, owner } = await boostedParty();
      const member = await harness.createUser();
      member.join(partyId);

      if (state === "inactive") harness.customers.set(owner.id, "inactive");

      if (state === "owner_left") owner.leave(partyId);

      if (state === "transferred")
        await harness.env.DB.prepare(
          "UPDATE party_boost SET partyDocumentId = ? WHERE ownerUserId = ?",
        )
          .bind(harness.createParty(), owner.id)
          .run();

      if (state === "verification_unavailable") harness.setRevenueCatStatus(503);
      const response = await harness.requestReceipt(partyId, image, member.cookie);
      expect(response.status).toBe(state === "verification_unavailable" ? 503 : 403);
      expect(run).not.toHaveBeenCalled();
    },
  );
  test("rejects malformed images and oversized requests before AI", async () => {
    const user = await harness.createUser();
    const partyId = harness.createParty();
    expect(
      (await harness.requestReceipt(partyId, "data:image/jpeg;base64,aGVsbG8=", user.cookie))
        .status,
    ).toBe(400);
    expect(
      (await harness.requestReceipt(partyId, "x".repeat(6 * 1024 * 1024), user.cookie)).status,
    ).toBe(413);
    expect(run).not.toHaveBeenCalled();
  });
  test("rate limits signed-in callers before entitlement or AI work", async () => {
    const user = await harness.createUser();
    limit.mockResolvedValue({ success: false });
    const response = await harness.requestReceipt(harness.createParty(), image, user.cookie);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(limit).toHaveBeenCalledWith({ key: user.id });
    expect(run).not.toHaveBeenCalled();
  });
  test.each([
    "bad json",
    JSON.stringify({ ...receipt, total: 12.34 }),
    JSON.stringify({ ...receipt, total: "NaN" }),
  ])("sanitizes invalid provider responses", async (response) => {
    const { partyId, owner } = await boostedParty();
    run.mockResolvedValue(completion(response));
    const result = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toEqual({
      error: { code: "unavailable", message: "Receipt analysis could not be completed." },
    });
  });
});

function completion(content: string, finishReason = "stop") {
  return {
    choices: [
      {
        index: 0,
        finish_reason: finishReason,
        message: { role: "assistant", content, refusal: null },
      },
    ],
  };
}
