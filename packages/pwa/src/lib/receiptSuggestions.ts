import type { Receipt } from "./api/receiptContract";

export interface ReceiptDraftValues {
  name: string;
  amount: number;
}

export function getReceiptSuggestions({
  receipt,
  currency,
  current,
  baseline,
}: {
  receipt: Receipt;
  currency: string;
  current: ReceiptDraftValues;
  baseline: ReceiptDraftValues;
}) {
  const currencyMismatch = receipt.currency !== null && receipt.currency !== currency;
  const title = receipt.merchantName?.slice(0, 50);

  // The editor stores major units with two decimal places for every currency.
  // Never round away printed precision or silently convert another currency.
  const representableTotal =
    receipt.total !== null && /^(0|[1-9]\d{0,11})(\.\d{1,2}0*|\.0+)?$/.test(receipt.total);

  const amount = representableTotal ? Number(receipt.total) : null;

  return {
    name: title && title !== current.name && current.name === baseline.name ? title : undefined,
    amount:
      !currencyMismatch &&
      amount !== null &&
      amount > 0 &&
      amount !== current.amount &&
      current.amount === baseline.amount
        ? amount
        : undefined,
    currencyMismatch,
  };
}
