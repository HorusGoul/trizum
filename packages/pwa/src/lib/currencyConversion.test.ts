import { describe, expect, test } from "vite-plus/test";
import {
  convertExpenseAmount,
  convertExpenseAmountToOriginal,
  getExpenseConversionFields,
} from "./currencyConversion";
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
    [2250, 0.75, 3000],
    [9, 1.2, 8],
    [3, 1.2, 2],
    [100, 1e-7, 1000000000],
    [100000000000000, 1e12, 100],
  ])("restores %s hundredths at %s with exact half-even division", (amount, rate, expected) => {
    expect(convertExpenseAmountToOriginal(amount, rate)).toBe(expected);
  });

  test("rejects invalid inverse conversions and unsafe results", () => {
    for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(convertExpenseAmountToOriginal(100, rate)).toBeUndefined();
    }

    expect(convertExpenseAmountToOriginal(-1, 0.75)).toBeUndefined();
    expect(convertExpenseAmountToOriginal(0.5, 0.75)).toBeUndefined();
    expect(convertExpenseAmountToOriginal(Number.MAX_SAFE_INTEGER, 0.1)).toBeUndefined();
  });
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

  test("original share amounts affect hashes but never balance inputs", () => {
    const original = { ...expense, shares: { bob: { type: "exact" as const, value: 9000 } } };

    const withMetadata = {
      ...original,
      shares: { bob: { ...original.shares.bob, originalAmount: 10000 } },
    };

    expect(exportIntoInput(withMetadata)).toEqual(exportIntoInput(original));
    expect(calculateExpenseHash(withMetadata)).not.toBe(calculateExpenseHash(original));
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
