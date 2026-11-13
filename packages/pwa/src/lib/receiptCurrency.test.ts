import { expect, test } from "vite-plus/test";
import { getSupportedReceiptCurrency } from "./receiptCurrency";

test.each([
  ["USD", "USD"],
  ["USD", "US$"],
  ["CAD", "CA$"],
  ["AUD", "AU$"],
  ["EUR", "€"],
  ["GBP", "GBP"],
  ["JPY", "JPY"],
  ["INR", "₹"],
])("accepts a matching explicit marker for %s: %s", (currency, currencyEvidence) => {
  expect(getSupportedReceiptCurrency({ currency, currencyEvidence })).toBe(currency);
});

test.each([
  ["USD", "$"],
  ["JPY", "¥"],
  ["GBP", "£"],
  ["KRW", "₩"],
  ["SEK", "kr"],
  ["INR", "Rs"],
  ["USD", "CAD"],
  ["USD", "€"],
  ["USD", "USA"],
  ["USD", "US dollars, probably"],
  ["USD", null],
  [null, "USD"],
  ["ZZZ", "ZZZ"],
  ["XXX", "XXX"],
  ["XTS", "XTS"],
])(
  "rejects ambiguous, unsupported or inconsistent evidence %s: %s",
  (currency, currencyEvidence) => {
    expect(getSupportedReceiptCurrency({ currency, currencyEvidence })).toBeUndefined();
  },
);

test("allows contextual evidence without a hardcoded country or language mapping", () => {
  for (const [currency, currencyEvidence] of [
    ["USD", "El Paso, TX 79925"],
    ["MXN", "Guadalajara, Jalisco"],
    ["EUR", "Language and receipt context support this currency"],
  ]) {
    expect(
      getSupportedReceiptCurrency({
        currency,
        currencyEvidence,
        currencyEvidenceSource: "context",
      }),
    ).toBe(currency);
  }

  expect(
    getSupportedReceiptCurrency({
      currency: "ZZZ",
      currencyEvidence: "Somewhere",
      currencyEvidenceSource: "context",
    }),
  ).toBeUndefined();
});
