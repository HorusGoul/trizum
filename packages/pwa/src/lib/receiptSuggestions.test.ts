import { describe, expect, test } from "vite-plus/test";
import type { Receipt } from "./api/receiptContract";
import { getReceiptSuggestions, getReceiptTitleOptions } from "./receiptSuggestions";

const receipt: Receipt = {
  merchantName: "The market",
  titleSuggestions: [],
  total: "12.34",
  currency: "EUR",
  currencyEvidence: null,
  currencyEvidenceSource: null,
  items: [],
};

const baseline = { name: "", amount: 0, currency: "EUR" };

const suggest = (data: Partial<Receipt> = {}, current = baseline) =>
  getReceiptSuggestions({
    receipt: { ...receipt, ...data },
    partyCurrency: "EUR",
    current,
    baseline,
  });

describe("receipt draft suggestions", () => {
  test("offers distinct bounded titles in ranked order with the merchant last", () => {
    expect(getReceiptTitleOptions({ ...receipt, titleSuggestions: ["Café", "Cafés"] })).toEqual([
      "Café",
      "Cafés",
      "The market",
    ]);
    expect(
      getReceiptTitleOptions({ ...receipt, titleSuggestions: ["The market", "The market"] }),
    ).toEqual(["The market"]);
    expect(
      getReceiptTitleOptions({ ...receipt, titleSuggestions: [], merchantName: " A ".repeat(50) }),
    ).toEqual([" A ".repeat(50).trim().slice(0, 50)]);
    expect(getReceiptTitleOptions({ ...receipt, merchantName: null })).toEqual([]);
  });
  test("prefers an activity title and falls back to the merchant only when needed", () => {
    expect(suggest({ titleSuggestions: ["Cafetería", "Cafés"] }).name).toBe("Cafetería");
    expect(suggest({ titleSuggestions: [] }).name).toBe("The market");
    expect(suggest({ merchantName: null, titleSuggestions: ["Cafés"] }).name).toBe("Cafés");
  });
  test("offers the merchant and printed total in editor units", () => {
    expect(suggest()).toEqual({
      name: "The market",
      amount: 12.34,
      currencyMismatch: false,
      currency: undefined,
    });
  });
  test("preserves edits made during processing, independently for each field", () => {
    expect(suggest({}, { name: "My title", amount: 0, currency: "EUR" })).toMatchObject({
      name: undefined,
      amount: 12.34,
    });
    expect(suggest({}, { name: "", amount: 20, currency: "EUR" })).toMatchObject({
      name: "The market",
      amount: undefined,
    });
  });
  test("does not suggest changes already present", () => {
    expect(suggest({}, { name: "The market", amount: 12.34, currency: "EUR" })).toMatchObject({
      name: undefined,
      amount: undefined,
    });
  });
  test("never applies another currency without conversion", () => {
    expect(suggest({ currency: "USD" })).toEqual({
      name: "The market",
      amount: undefined,
      currencyMismatch: true,
      currency: undefined,
    });
  });
  test("allows totals without a printed currency using the selected expense currency", () => {
    expect(suggest({ currency: null }).amount).toBe(12.34);
  });
  test.each([null, "0", "-1.00", "1.005", "1.234567"])(
    "does not round or apply invalid expense total %s",
    (total) => {
      expect(suggest({ total }).amount).toBeUndefined();
    },
  );
  test("accepts insignificant trailing zeros without changing the total", () => {
    expect(suggest({ total: "1.2300" }).amount).toBe(1.23);
    expect(suggest({ total: "1.000" }).amount).toBe(1);
  });
  test("handles unreadable receipts and bounds merchant titles to the editor limit", () => {
    expect(suggest({ merchantName: null, titleSuggestions: [], total: null }).name).toBeUndefined();
    expect(suggest({ merchantName: "A".repeat(100) }).name).toHaveLength(50);
  });
});

test("offers a confirmed foreign currency and its total even when the numeric value matches", () => {
  const current = { ...baseline, amount: 12.34 };
  expect(
    getReceiptSuggestions({
      receipt: { ...receipt, currency: "USD", currencyEvidence: "US$" },
      partyCurrency: "EUR",
      current,
      baseline: current,
    }),
  ).toMatchObject({ currency: "USD", amount: 12.34, currencyMismatch: true });
});

test("does not suggest changing back to the party currency or an already selected currency", () => {
  const current = { ...baseline, currency: "USD" };

  for (const currency of ["EUR", "USD"]) {
    expect(
      getReceiptSuggestions({
        receipt: { ...receipt, currency, currencyEvidence: currency },
        partyCurrency: "EUR",
        current,
        baseline: current,
      }).currency,
    ).toBeUndefined();
  }
});

test("preserves currency and amount edits made during analysis", () => {
  for (const current of [
    { ...baseline, currency: "GBP" },
    { ...baseline, amount: 20 },
  ]) {
    expect(
      getReceiptSuggestions({
        receipt: { ...receipt, currency: "USD", currencyEvidence: "USD" },
        partyCurrency: "EUR",
        current,
        baseline,
      }),
    ).toMatchObject({ currency: undefined, amount: undefined });
  }
});

test("offers only a currency change when the foreign total cannot be represented", () => {
  expect(suggest({ currency: "USD", currencyEvidence: "USD", total: "1.005" })).toMatchObject({
    currency: "USD",
    amount: undefined,
  });
});

test("offers a different currency inferred from receipt context", () => {
  expect(
    suggest({
      currency: "USD",
      currencyEvidence: "El Paso, TX 79925",
      currencyEvidenceSource: "context",
    }),
  ).toMatchObject({ currency: "USD", amount: 12.34 });
});
