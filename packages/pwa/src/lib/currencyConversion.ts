import { dinero, halfEven, multiply, toSnapshot, transformScale } from "dinero.js/bigint";
import type { Expense } from "../models/expense";

/** Amounts in trizum use hundredths for every currency, including JPY and KWD. */
export function convertExpenseAmount(amount: number, exchangeRate: number): number | undefined {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isFinite(exchangeRate) ||
    exchangeRate <= 0
  ) {
    return undefined;
  }

  const [coefficient, exponent = "0"] = exchangeRate.toString().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const scale = fraction.length - Number(exponent);
  const multiplier = BigInt(whole + fraction) * 10n ** BigInt(Math.max(-scale, 0));

  const money = dinero({
    amount: BigInt(amount),
    currency: { code: "XXX", base: 10n, exponent: 2n },
  });

  const converted = multiply(money, { amount: multiplier, scale: BigInt(Math.max(scale, 0)) });
  const result = Number(toSnapshot(transformScale(converted, 2n, halfEven)).amount);

  return Number.isSafeInteger(result) ? result : undefined;
}

export interface ExpenseConversionValues {
  originalAmount?: Expense["originalAmount"] | null;
  exchangeRate?: number | null;
}

/** Omit cleared metadata rather than writing undefined into an Automerge document. */
export function getExpenseConversionFields(
  values: ExpenseConversionValues,
): Pick<Expense, "originalAmount" | "exchangeRate"> {
  const fields: Pick<Expense, "originalAmount" | "exchangeRate"> = {};

  if (values.originalAmount) {
    fields.originalAmount = values.originalAmount;

    if (values.exchangeRate != null) fields.exchangeRate = values.exchangeRate;
  }

  return fields;
}
