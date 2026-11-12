import { isCurrencyCode, type CurrencyCode } from "./money";

// Deliberately small: shared symbols such as $, ¥, £, ₩, kr and Rs are insufficient.
const currencyMarkers = new Map<string, CurrencyCode>([
  ["€", "EUR"],
  ["₹", "INR"],
  ["₽", "RUB"],
  ["₺", "TRY"],
  ["₴", "UAH"],
  ["₫", "VND"],
  ["฿", "THB"],
  ["US$", "USD"],
  ["CA$", "CAD"],
  ["AU$", "AUD"],
  ["NZ$", "NZD"],
  ["HK$", "HKD"],
  ["SG$", "SGD"],
]);

/** Evidence must be a literal, clearly readable marker associated with the bill total. */
export function getConfirmedReceiptCurrency(receipt: {
  currency: string | null;
  currencyEvidence: string | null;
}): CurrencyCode | undefined {
  const { currency, currencyEvidence } = receipt;

  if (
    !currency ||
    !isCurrencyCode(currency) ||
    currency === "XXX" ||
    currency === "XTS" ||
    !currencyEvidence
  )
    return undefined;
  const marker = currencyEvidence.trim().toUpperCase();

  return marker === currency || currencyMarkers.get(marker) === currency ? currency : undefined;
}
