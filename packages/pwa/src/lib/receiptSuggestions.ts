import type { CurrencyCode } from "./money";
import type { ExpenseConversionValues } from "./currencyConversion";
import { getSupportedReceiptCurrency } from "./receiptCurrency";
import type { Receipt } from "./api/receiptContract";

export interface ReceiptDraftValues {
  name: string;
  amount: number;
  currency: string;
}

export function getReceiptTitleOptions(receipt: Receipt): string[] {
  const titles = [...receipt.titleSuggestions, receipt.merchantName].flatMap((title) => {
    const value = title?.trim().slice(0, 50);

    return value ? [value] : [];
  });

  return [...new Set(titles)];
}

export function getReceiptSuggestions({
  receipt,
  partyCurrency,
  current,
  baseline,
}: {
  receipt: Receipt;
  partyCurrency: string;
  current: ReceiptDraftValues;
  baseline: ReceiptDraftValues;
}) {
  const currencyMismatch = receipt.currency !== null && receipt.currency !== current.currency;
  const confirmedCurrency = getSupportedReceiptCurrency(receipt);

  const currency: CurrencyCode | undefined =
    confirmedCurrency &&
    confirmedCurrency !== partyCurrency &&
    confirmedCurrency !== current.currency &&
    current.currency === baseline.currency &&
    current.amount === baseline.amount
      ? confirmedCurrency
      : undefined;

  const title = getReceiptTitleOptions(receipt)[0];

  // The editor stores major units with two decimal places for every currency.
  // Never round away printed precision or silently convert another currency.
  const representableTotal =
    receipt.total !== null && /^(0|[1-9]\d{0,11})(\.\d{1,2}0*|\.0+)?$/.test(receipt.total);

  const amount = representableTotal ? Number(receipt.total) : null;

  return {
    name: title && title !== current.name && current.name === baseline.name ? title : undefined,
    amount:
      (!currencyMismatch || currency !== undefined) &&
      current.currency === baseline.currency &&
      amount !== null &&
      amount > 0 &&
      (amount !== current.amount || currency !== undefined) &&
      current.amount === baseline.amount
        ? amount
        : undefined,
    currency,
    currencyMismatch,
  };
}

export type ReceiptSuggestions = ReturnType<typeof getReceiptSuggestions>;

export function hasReceiptSuggestions(suggestions: ReceiptSuggestions) {
  return (
    suggestions.name !== undefined ||
    suggestions.amount !== undefined ||
    suggestions.currency !== undefined
  );
}

export function getReceiptDraftValues(
  values: { name: string; amount: number } & ExpenseConversionValues,
  partyCurrency: CurrencyCode,
): ReceiptDraftValues {
  return {
    name: values.name,
    amount: values.originalAmount ? values.originalAmount.amount / 100 : values.amount,
    currency: values.originalAmount?.currency ?? partyCurrency,
  };
}
