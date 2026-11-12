import { Buffer } from "node:buffer";
import { MAX_RECEIPT_REQUEST_BYTES } from "../../src/lib/api/receiptContract";
import { createReceiptImageTestHarness } from "../premium/receiptImageTestHarness";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPartyBoostTestHarness } from "../premium/partyBoostTestHarness";
import type { ReceiptAI } from "../premium/receiptExtraction";

const image = "data:image/jpeg;base64,/9j/AA==";

const receipt = {
  merchantName: "Corner shop",
  titleSuggestions: [],
  total: "12.34",
  currency: "EUR",
  currencyEvidence: "EUR",
  currencyEvidenceSource: null,
  items: [{ name: "Apples", quantity: "0,750 kg", unitPrice: "2.490", lineTotal: "1.87" }],
};

describe("receipt analysis authorization and contract", () => {
  let harness: Awaited<ReturnType<typeof createPartyBoostTestHarness>>;
  const run = vi.fn<ReceiptAI["run"]>();
  const limit = vi.fn<RateLimit["limit"]>();
  let images: ReturnType<typeof createReceiptImageTestHarness>;
  beforeEach(async () => {
    harness = await createPartyBoostTestHarness();
    run.mockReset().mockImplementation(async (model, input) => {
      if (model === "@cf/cloudflare/clef" && "questions" in input) {
        return {
          model: "clef",
          answers: Object.fromEntries(
            Object.keys(input.questions).map((field) => [
              field,
              {
                type: "choice" as const,
                choice: "supported" as const,
                probabilities: { supported: 0.999, unsupported: 0.0005, unclear: 0.0005 },
                confidence: 0.999,
              },
            ]),
          ),
        };
      }

      return completion(JSON.stringify(receipt));
    });
    limit.mockReset().mockResolvedValue({ success: true });
    images = createReceiptImageTestHarness();
    harness.env.IMAGES = images.images;
    harness.env.AI = { run };
    harness.env.RECEIPT_RATE_LIMITER = { limit };
  }, 30_000);
  afterEach(async () => {
    await harness.dispose();
  });

  function gemmaInput() {
    const input = run.mock.calls[0][1];

    if (!("messages" in input)) throw new Error("Expected Gemma input");

    return input;
  }

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
    expect(images.info).not.toHaveBeenCalled();
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
    expect(run).toHaveBeenCalledTimes(2);
  });
  test("prepares a 5 MiB receipt before either AI model sees it", async () => {
    const { partyId, owner } = await boostedParty();
    const bytes = Buffer.alloc(5 * 1024 * 1024);
    bytes.set([0xff, 0xd8, 0xff]);
    const large = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const response = await harness.requestReceipt(partyId, large, owner.cookie);
    expect(response.status).toBe(200);
    expect(images.input).toHaveBeenCalledOnce();
    expect(gemmaInput().messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: images.preparedImage, detail: "high" } },
          ],
        }),
      ]),
    );
    expect(run).toHaveBeenLastCalledWith(
      "@cf/cloudflare/clef",
      expect.objectContaining({ images: [images.preparedImage] }),
      expect.any(Object),
    );
  });

  test("keeps image processing failures private and never invokes AI", async () => {
    const { partyId, owner } = await boostedParty();
    images.info.mockRejectedValue(new Error("Private image processing diagnostics"));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unavailable", message: "Receipt analysis could not be completed." },
    });
    expect(run).not.toHaveBeenCalled();
  });

  test("fails closed when the Images binding is unavailable", async () => {
    const { partyId, owner } = await boostedParty();
    delete harness.env.IMAGES;
    expect((await harness.requestReceipt(partyId, image, owner.cookie)).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  test("preserves multilingual receipt fields from Gemma chat completions", async () => {
    const { partyId, owner } = await boostedParty();

    const multilingualReceipt = {
      merchantName: "東京マーケット / سوق",
      titleSuggestions: [],
      total: "12.34",
      currency: "JPY",
      currencyEvidence: null,
      currencyEvidenceSource: null,
      items: [
        { name: "りんご / تفاح", quantity: "0,750 kg", unitPrice: "2.490", lineTotal: "1.87" },
      ],
    };

    run.mockResolvedValueOnce(completion(JSON.stringify(multilingualReceipt)));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(multilingualReceipt);
    expect(run).toHaveBeenCalledWith(
      "@cf/google/gemma-4-26b-a4b-it",
      expect.objectContaining({
        messages: expect.arrayContaining([
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: images.preparedImage, detail: "high" } },
            ],
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
  test.each(["en", "es"] as const)(
    "keeps receipt-language and %s title choices in ranked order",
    async (locale) => {
      const { partyId, owner } = await boostedParty();

      const titledReceipt = {
        ...receipt,
        titleSuggestions:
          locale === "en" ? ["Cafetería", "Coffee", "Cafés"] : ["コーヒー", "Café", "喫茶店"],
      };

      run.mockResolvedValueOnce(completion(JSON.stringify(titledReceipt)));
      const response = await harness.requestReceipt(partyId, image, owner.cookie, locale);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(titledReceipt);
      expect(gemmaInput().messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              `The app language is ${locale === "es" ? "Spanish" : "English"}. Prefer the receipt language for the first title and include an app-language alternative when different.`,
            ),
          }),
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("consider the printed transaction date and time"),
          }),
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              'For a receipt from Spain printed at 18:00 with coffees, prefer "Cafés" / "Coffee" or "Cafetería", not "Desayuno" / "Breakfast".',
            ),
          }),
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              "Never use the current time, upload time or app language to guess when or where the purchase happened.",
            ),
          }),
        ]),
      );
    },
  );
  test("returns literal foreign-currency evidence and prompts conservatively", async () => {
    const { partyId, owner } = await boostedParty();
    harness.documents.get(partyId)!.currency = "GBP";
    const foreign = { ...receipt, currency: "USD", currencyEvidence: "US$" };
    run.mockResolvedValueOnce(completion(JSON.stringify(foreign)));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    await expect(response.json()).resolves.toEqual(foreign);
    const system = gemmaInput().messages?.[0];
    expect(system).toMatchObject({
      content: expect.stringContaining("The party currency is GBP. Use it only to compare"),
    });
    expect(run).toHaveBeenLastCalledWith(
      "@cf/cloudflare/clef",
      expect.objectContaining({
        images: [images.preparedImage],
        state: expect.objectContaining({ partyCurrency: "GBP", receipt: foreign }),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(system).toMatchObject({
      role: "system",
      content: expect.stringContaining(
        "A clear printed code or unambiguous currency marker takes priority",
      ),
    });
    expect(system).toMatchObject({
      content: expect.stringContaining("combining the address, city/region/country"),
    });
    expect(system).toMatchObject({
      content: expect.stringContaining("a language used across many countries needs other hints"),
    });
    expect(system).toMatchObject({
      content: expect.stringContaining("Do not hardcode a language-to-currency rule"),
    });
  });
  test("returns a contextual currency with its supporting receipt clues", async () => {
    const { partyId, owner } = await boostedParty();

    const inferred = {
      ...receipt,
      currency: "USD",
      currencyEvidence: "El Paso, TX 79925",
      currencyEvidenceSource: "context",
    };

    run.mockResolvedValueOnce(completion(JSON.stringify(inferred)));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(inferred);
    expect(run).toHaveBeenLastCalledWith(
      "@cf/cloudflare/clef",
      expect.objectContaining({
        state: expect.objectContaining({ receipt: inferred }),
        questions: expect.objectContaining({
          currency: expect.objectContaining({
            instructions: expect.stringContaining("distinguish plausible alternatives"),
          }),
        }),
      }),
      expect.any(Object),
    );
  });

  test("does not expose ambiguous evidence as a confident currency marker", async () => {
    const { partyId, owner } = await boostedParty();
    run.mockResolvedValueOnce(
      completion(JSON.stringify({ ...receipt, currency: "USD", currencyEvidence: "$" })),
    );
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    await expect(response.json()).resolves.toMatchObject({
      currency: "USD",
      currencyEvidence: null,
      currencyEvidenceSource: null,
    });
  });
  test("returns a sanitized failure when Clef is unavailable", async () => {
    const { partyId, owner } = await boostedParty();
    run
      .mockResolvedValueOnce(completion(JSON.stringify(receipt)))
      .mockRejectedValueOnce(new Error("Private image and provider diagnostics"));
    const response = await harness.requestReceipt(partyId, image, owner.cookie);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unavailable", message: "Receipt analysis could not be completed." },
    });
  });
  test.each(["length", "content_filter", "tool_calls"])(
    "rejects a Gemma completion stopped by %s",
    async (finishReason) => {
      const { partyId, owner } = await boostedParty();
      run.mockResolvedValueOnce(completion(JSON.stringify(receipt), finishReason));
      const response = await harness.requestReceipt(partyId, image, owner.cookie);
      expect(response.status).toBe(503);
    },
  );
  test("rejects refusals without exposing provider content", async () => {
    const { partyId, owner } = await boostedParty();
    run.mockResolvedValueOnce({
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
      (
        await harness.requestReceipt(
          partyId,
          "x".repeat(MAX_RECEIPT_REQUEST_BYTES + 1),
          user.cookie,
        )
      ).status,
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
    JSON.stringify({ ...receipt, currencyEvidence: { confidence: 0.99 } }),
    JSON.stringify({ ...receipt, titleSuggestions: ["Cafetería", "Coffee", "Cafés", "Café"] }),
  ])("sanitizes invalid provider responses", async (response) => {
    const { partyId, owner } = await boostedParty();
    run.mockResolvedValueOnce(completion(response));
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
