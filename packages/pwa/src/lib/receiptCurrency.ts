import { isCurrencyCode, type CurrencyCode } from "./money";

// Printed markers only: shared symbols need contextual evidence instead.
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

/** Printed markers are checked literally; contextual evidence is independently verified against the photo. */
export function getSupportedReceiptCurrency(receipt: {
  currency: string | null;
  currencyEvidence: string | null;
  currencyEvidenceSource?: "printed" | "context" | null;
}): CurrencyCode | undefined {
  const { currency, currencyEvidence, currencyEvidenceSource } = receipt;

  if (
    !currency ||
    !isCurrencyCode(currency) ||
    currency === "XXX" ||
    currency === "XTS" ||
    !currencyEvidence
  )
    return undefined;

  if (currencyEvidenceSource === "context") return currency;
  const marker = currencyEvidence.trim().toUpperCase();

  return marker === currency || currencyMarkers.get(marker) === currency ? currency : undefined;
}
