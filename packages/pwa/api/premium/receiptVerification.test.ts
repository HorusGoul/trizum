import { beforeEach, expect, test, vi } from "vite-plus/test";
import type { Receipt } from "../../src/lib/api/receiptContract";
import type { ReceiptAI } from "./receiptExtraction";
import { verifyReceipt, type ReceiptVerificationResponse } from "./receiptVerification";

const receipt: Receipt = {
  merchantName: "Cafe",
  titleSuggestions: ["Cafés", "Coffee", "Cafetería"],
  total: "15.70",
  currency: "USD",
  currencyEvidence: "US$",
  items: [{ name: "Coffee", quantity: "2", unitPrice: "3.00", lineTotal: "6.00" }],
};

const image = "data:image/jpeg;base64,/9j/AA==";
const context = { locale: "en" as const, partyCurrency: "EUR" as const };
const run = vi.fn<ReceiptAI["run"]>();
const ai = { run };

function answer(
  probability = 0.999,
  choice: "supported" | "unsupported" | "unclear" = "supported",
) {
  return {
    type: "choice" as const,
    choice,
    probabilities: { supported: probability, unsupported: 0, unclear: 1 - probability },
    confidence: probability,
  };
}

function response(
  overrides: ReceiptVerificationResponse["answers"] = {},
): ReceiptVerificationResponse {
  return {
    model: "clef",
    answers: {
      merchant: answer(),
      total: answer(),
      currency: answer(),
      items: answer(),
      title_0: answer(),
      title_1: answer(),
      title_2: answer(),
      ...overrides,
    },
  };
}

beforeEach(() => {
  run.mockReset().mockResolvedValue(response());
});

test("checks each candidate independently against the same photo with party context", async () => {
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toEqual(receipt);
  expect(run).toHaveBeenCalledExactlyOnceWith(
    "@cf/cloudflare/clef",
    expect.objectContaining({
      model: "clef",
      images: [image],
      state: expect.objectContaining({ receipt, partyCurrency: "EUR", locale: "en" }),
      questions: expect.objectContaining({
        merchant: expect.any(Object),
        total: expect.any(Object),
        currency: expect.any(Object),
        items: expect.any(Object),
        title_0: expect.any(Object),
        title_1: expect.any(Object),
        title_2: expect.any(Object),
      }),
    }),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("drops unsupported merchant, items and titles while retaining independently verified values", async () => {
  run.mockResolvedValue(
    response({
      merchant: answer(0, "unsupported"),
      items: answer(0.5, "unclear"),
      title_0: answer(0, "unsupported"),
      title_2: answer(0.5, "unclear"),
    }),
  );
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toEqual({
    ...receipt,
    merchantName: null,
    items: [],
    titleSuggestions: ["Coffee"],
  });
});

test.each(["unsupported", "unclear"] as const)(
  "does not mistake a %s total for a verified amount",
  async (choice) => {
    run.mockResolvedValue(response({ total: answer(0.99, choice) }));
    await expect(verifyReceipt(image, receipt, ai, context)).resolves.toMatchObject({
      total: null,
      currency: "USD",
    });
  },
);

test.each([0, 0.8, 0.979])(
  "suppresses currency and its total when currency support is only %s",
  async (probability) => {
    run.mockResolvedValue(response({ currency: answer(probability) }));
    await expect(verifyReceipt(image, receipt, ai, context)).resolves.toMatchObject({
      currency: null,
      currencyEvidence: null,
      total: null,
      titleSuggestions: receipt.titleSuggestions,
    });
  },
);

test("keeps a stricter threshold for currency than ordinary supported decisions", async () => {
  run.mockResolvedValue(
    response({ total: answer(0.95), currency: answer(0.98), title_0: answer(0.949) }),
  );
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toMatchObject({
    total: "15.70",
    currency: "USD",
    titleSuggestions: receipt.titleSuggestions,
  });
});

test("retains supported decisions from the live receipt regression without treating scores as accuracy", async () => {
  run.mockResolvedValue(
    response({
      merchant: answer(0.885),
      title_0: answer(0.7485),
      title_1: answer(0.8614),
      total: {
        type: "choice",
        choice: "supported",
        probabilities: { supported: 0.4331, unsupported: 0.2473, unclear: 0.3196 },
        confidence: 0.0263,
      },
      items: {
        type: "choice",
        choice: "unsupported",
        probabilities: { supported: 0.0561, unsupported: 0.6072, unclear: 0.3367 },
        confidence: 0.2279,
      },
    }),
  );
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toEqual({
    ...receipt,
    items: [],
  });
});

test("rejects tied or inconsistent supported choices", async () => {
  run.mockResolvedValue(
    response({
      total: answer(0.5),
      merchant: answer(0.4),
    }),
  );
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toMatchObject({
    total: null,
    merchantName: null,
  });
});

test("does not approve a missing answer", async () => {
  const result = response();
  delete result.answers.total;
  run.mockResolvedValue(result);
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toMatchObject({
    total: null,
    currency: "USD",
  });
});

test("can verify a total without inferring a currency when extraction had none", async () => {
  await expect(
    verifyReceipt(image, { ...receipt, currency: null, currencyEvidence: null }, ai, context),
  ).resolves.toMatchObject({ total: "15.70", currency: null });
});

test("skips verification when no values were extracted", async () => {
  const empty: Receipt = {
    merchantName: null,
    titleSuggestions: [],
    total: null,
    currency: null,
    currencyEvidence: null,
    items: [],
  };

  await expect(verifyReceipt(image, empty, ai, context)).resolves.toEqual(empty);
  expect(run).not.toHaveBeenCalled();
});

test("returns an empty receipt when no candidate can be verified", async () => {
  run.mockResolvedValue({ model: "clef", answers: {} });
  await expect(verifyReceipt(image, receipt, ai, context)).resolves.toEqual({
    merchantName: null,
    titleSuggestions: [],
    total: null,
    currency: null,
    currencyEvidence: null,
    items: [],
  });
});

test("rejects malformed probabilities and verifier failures", async () => {
  run.mockResolvedValue(
    response({
      total: { ...answer(), probabilities: { supported: 0.999, unsupported: 1, unclear: 0 } },
    }),
  );
  await expect(verifyReceipt(image, receipt, ai, context)).rejects.toThrow("Invalid input");
  run.mockRejectedValue(new Error("Verifier unavailable"));
  await expect(verifyReceipt(image, receipt, ai, context)).rejects.toThrow("Verifier unavailable");
});
