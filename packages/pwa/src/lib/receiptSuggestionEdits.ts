import type { ExpenseEditorFormValues } from "../components/ExpenseEditor";
import type { Receipt } from "./api/receiptContract";
import type { ExchangeRates } from "./api/exchangeRatesContract";
import type { CurrencyCode } from "./money";
import type { AppFormApi } from "./reactFormTypes";
import { getExchangeRate } from "./exchangeRateTables";
import { setExpenseEditorCurrency, setExpenseEditorCurrencyAmount } from "./expenseEditorCurrency";
import {
  getReceiptDraftValues,
  getReceiptSuggestions,
  getReceiptTitleOptions,
  type ReceiptDraftValues,
} from "./receiptSuggestions";

/** Revalidate against the live draft; a foreign total requires explicit currency acceptance. */
export function applyReceiptSuggestions(
  form: Pick<AppFormApi<ExpenseEditorFormValues>, "state" | "setFieldValue">,
  {
    receipt,
    baseline,
    partyCurrency,
    rates,
    selected,
  }: {
    receipt: Receipt;
    baseline: ReceiptDraftValues;
    partyCurrency: CurrencyCode;
    rates: ExchangeRates;
    selected: Partial<ReceiptDraftValues>;
  },
) {
  const available = getReceiptSuggestions({
    receipt,
    baseline,
    partyCurrency,
    current: getReceiptDraftValues(form.state.values, partyCurrency),
  });

  let applied = false;

  if (
    available.name !== undefined &&
    selected.name !== undefined &&
    getReceiptTitleOptions(receipt).includes(selected.name)
  ) {
    form.setFieldValue("name", selected.name);
    applied = true;
  }

  const acceptCurrency =
    available.currency !== undefined && selected.currency === available.currency;

  if (acceptCurrency && available.currency) {
    setExpenseEditorCurrency(
      form,
      partyCurrency,
      available.currency,
      getExchangeRate(rates, available.currency)?.rate ?? null,
    );
    applied = true;
  }

  if (
    selected.amount !== undefined &&
    selected.amount === available.amount &&
    (!available.currencyMismatch || acceptCurrency)
  ) {
    setExpenseEditorCurrencyAmount(form, selected.amount);
    applied = true;
  }

  return applied;
}
