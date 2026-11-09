import { describe, expect, test } from "vite-plus/test";
import { convertExpenseAmount, getExpenseConversionFields } from "./currencyConversion";
import { calculateExpenseHash, exportIntoInput, type Expense } from "../models/expense";

const expense: Expense = {
  id: "expense:chunk",
  name: "Dinner",
  paidAt: new Date("2026-01-01"),
  paidBy: { alice: 9000 },
  shares: { bob: { type: "divide", value: 1 } },
  photos: [],
  __hash: "",
};

describe("currency conversion", () => {
  test.each([
    [10000, 0.9, 9000],
    [1500, 150, 225000],
    [100, 1.005, 100],
    [3, 0.5, 2],
    [1, 0.5, 0],
    [100, 0.0000001, 0],
    [100, 1e12, 100000000000000],
    [99999999, 1.12345678901234, 112345678],
  ])("converts %s hundredths at %s with half-even rounding", (amount, rate, expected) => {
    expect(convertExpenseAmount(amount, rate)).toBe(expected);
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid rate %s", (rate) => {
    expect(convertExpenseAmount(100, rate)).toBeUndefined();
  });

  test("rejects invalid amounts and unsafe results", () => {
    expect(convertExpenseAmount(1.5, 1)).toBeUndefined();
    expect(convertExpenseAmount(-100, 1)).toBeUndefined();
    expect(convertExpenseAmount(Number.MAX_SAFE_INTEGER, 2)).toBeUndefined();
  });

  test("conversion metadata affects the hash without changing balance inputs", () => {
    const converted = {
      ...expense,
      originalAmount: { amount: 10000, currency: "USD" as const },
      exchangeRate: 0.9,
    };

    expect(exportIntoInput(converted)).toEqual(exportIntoInput(expense));
    expect(calculateExpenseHash(converted)).not.toBe(calculateExpenseHash(expense));
    expect(calculateExpenseHash({ ...converted, exchangeRate: 0.91 })).not.toBe(
      calculateExpenseHash(converted),
    );
    expect(
      calculateExpenseHash({ ...converted, originalAmount: { amount: 9999, currency: "USD" } }),
    ).not.toBe(calculateExpenseHash(converted));
  });

  test("cleared conversion metadata does not write null or undefined into Automerge", () => {
    expect(getExpenseConversionFields({ originalAmount: null, exchangeRate: null })).toEqual({});
    expect(getExpenseConversionFields({})).toEqual({});
    expect(
      getExpenseConversionFields({
        originalAmount: { amount: 100, currency: "USD" },
        exchangeRate: 0.9,
      }),
    ).toEqual({ originalAmount: { amount: 100, currency: "USD" }, exchangeRate: 0.9 });
  });
});
