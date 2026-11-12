import { expect, test } from "vite-plus/test";
import { getConfirmedReceiptCurrency } from "./receiptCurrency";

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
  expect(getConfirmedReceiptCurrency({ currency, currencyEvidence })).toBe(currency);
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
    expect(getConfirmedReceiptCurrency({ currency, currencyEvidence })).toBeUndefined();
  },
);
