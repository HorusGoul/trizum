import { describe, expect, test } from "vite-plus/test";
import type { Receipt } from "./api/receiptContract";
import { getReceiptSuggestions } from "./receiptSuggestions";

const receipt: Receipt = { merchantName: "The market", total: "12.34", currency: "EUR", items: [] };
const baseline = { name: "", amount: 0 };

const suggest = (data: Partial<Receipt> = {}, current = baseline) =>
  getReceiptSuggestions({ receipt: { ...receipt, ...data }, currency: "EUR", current, baseline });

describe("receipt draft suggestions", () => {
  test("offers the merchant and printed total in editor units", () => {
    expect(suggest()).toEqual({ name: "The market", amount: 12.34, currencyMismatch: false });
  });
  test("preserves edits made during processing, independently for each field", () => {
    expect(suggest({}, { name: "My title", amount: 0 })).toMatchObject({
      name: undefined,
      amount: 12.34,
    });
    expect(suggest({}, { name: "", amount: 20 })).toMatchObject({
      name: "The market",
      amount: undefined,
    });
  });
  test("does not suggest changes already present", () => {
    expect(suggest({}, { name: "The market", amount: 12.34 })).toMatchObject({
      name: undefined,
      amount: undefined,
    });
  });
  test("never applies another currency without conversion", () => {
    expect(suggest({ currency: "USD" })).toEqual({
      name: "The market",
      amount: undefined,
      currencyMismatch: true,
    });
  });
  test("allows totals without a printed currency using the party currency", () => {
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
    expect(suggest({ merchantName: null, total: null }).name).toBeUndefined();
    expect(suggest({ merchantName: "A".repeat(100) }).name).toHaveLength(50);
  });
});
