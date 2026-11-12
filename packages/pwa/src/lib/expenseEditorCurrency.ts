import type { ExpenseEditorFormValues } from "../components/ExpenseEditor";
import type { AppFormApi } from "./reactFormTypes";
import {
  convertExpenseAmount,
  convertExpenseAmountToOriginal,
  type ExpenseConversionValues,
} from "./currencyConversion";
import { getExpenseEditorUnitShares, type ExpenseEditorShares } from "./expenseEditor";
import { convertToUnits } from "./expenses";

interface CurrencyValues extends ExpenseConversionValues {
  amount: number;
  shares: ExpenseEditorShares;
}

export function getExpenseEditorCurrencyAmount(values: CurrencyValues) {
  return values.originalAmount ? values.originalAmount.amount / 100 : values.amount;
}

/** Apply an entered total in the selected currency, preserving the current rate. */
export function setExpenseEditorCurrencyAmount(
  form: Pick<AppFormApi<ExpenseEditorFormValues>, "state" | "setFieldValue">,
  amount: number,
) {
  const { originalAmount, exchangeRate } = form.state.values;

  if (originalAmount) {
    const units = convertToUnits(amount);
    form.setFieldValue("originalAmount", { currency: originalAmount.currency, amount: units });
    form.setFieldValue("amount", (convertExpenseAmount(units, exchangeRate ?? 0) ?? 0) / 100);
  } else {
    form.setFieldValue("amount", amount);
  }
}

/** Only the editor draft uses exact shares in the selected expense currency. */
export function getExpenseEditorDraftValues<T extends CurrencyValues>(values: T): T {
  const { originalAmount, exchangeRate } = values;

  if (!originalAmount) return { ...values, shares: clearOriginalAmounts(values.shares) };

  const inferred = hasRate(exchangeRate)
    ? convertShares(values.shares, convertToUnits(values.amount), originalAmount.amount, (amount) =>
        convertExpenseAmountToOriginal(amount, exchangeRate),
      )
    : values.shares;

  return {
    ...values,
    shares: Object.fromEntries(
      Object.entries(values.shares).map(([id, share]) => [
        id,
        {
          type: share.type,
          value:
            share.type === "exact" ? (share.originalAmount ?? inferred[id].value) : share.value,
        },
      ]),
    ),
  };
}

/** Saving and collaborative updates always receive exact shares in party currency. */
export function getExpenseEditorStoredValues<T extends CurrencyValues>(
  values: T,
  savedValues?: CurrencyValues,
): T {
  const { originalAmount, exchangeRate } = values;

  if (!originalAmount) return { ...values, shares: clearOriginalAmounts(values.shares) };

  // An inferred foreign share may not represent the authoritative saved allocation exactly.
  if (savedValues && monetaryValuesMatch(values, getExpenseEditorDraftValues(savedValues))) {
    return {
      ...values,
      shares: Object.fromEntries(
        Object.entries(savedValues.shares).map(([id, share]) => [id, { ...share }]),
      ),
    };
  }

  const originalAmounts = getExpenseEditorUnitShares(originalAmount.amount / 100, values.shares);

  const converted = hasRate(exchangeRate)
    ? convertShares(values.shares, originalAmount.amount, convertToUnits(values.amount), (amount) =>
        convertExpenseAmount(amount, exchangeRate),
      )
    : values.shares;

  return {
    ...values,
    shares: Object.fromEntries(
      Object.entries(converted).map(([id, share]) => [
        id,
        {
          ...share,
          originalAmount: originalAmounts[id],
        },
      ]),
    ),
  };
}

function monetaryValuesMatch(left: CurrencyValues, right: CurrencyValues) {
  const entries = Object.entries(left.shares);

  return (
    left.amount === right.amount &&
    left.exchangeRate === right.exchangeRate &&
    left.originalAmount?.amount === right.originalAmount?.amount &&
    left.originalAmount?.currency === right.originalAmount?.currency &&
    entries.length === Object.keys(right.shares).length &&
    entries.every(
      ([id, share]) =>
        share.type === right.shares[id]?.type && share.value === right.shares[id]?.value,
    )
  );
}

function hasRate(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate) && rate > 0;
}

function clearOriginalAmounts(shares: ExpenseEditorShares): ExpenseEditorShares {
  return Object.fromEntries(
    Object.entries(shares).map(([id, { originalAmount: _originalAmount, ...share }]) => [
      id,
      share,
    ]),
  );
}

function convertShares(
  shares: ExpenseEditorShares,
  sourceAmount: number,
  targetAmount: number,
  convert: (amount: number) => number | undefined,
): ExpenseEditorShares {
  const entries = Object.entries(shares);
  const sourceAmounts = getExpenseEditorUnitShares(sourceAmount / 100, shares);
  const sharesTotal = Object.values(sourceAmounts).reduce((sum, amount) => sum + amount, 0);

  // Convert a balanced split together so rounding cannot overdraw the remaining weighted shares.
  if (sharesTotal === sourceAmount && sourceAmount > 0) {
    const amounts = getExpenseEditorUnitShares(
      targetAmount / 100,
      Object.fromEntries(
        entries
          .filter(([id]) => sourceAmounts[id] > 0)
          .map(([id]) => [id, { type: "divide", value: sourceAmounts[id] }]),
      ),
    );

    return Object.fromEntries(
      entries.map(([id, share]) => [
        id,
        share.type === "exact" ? { type: "exact", value: amounts[id] ?? 0 } : share,
      ]),
    );
  }

  return Object.fromEntries(
    entries.map(([id, share]) => [
      id,
      share.type === "exact"
        ? { type: "exact", value: convert(share.value) ?? share.value }
        : share,
    ]),
  );
}
