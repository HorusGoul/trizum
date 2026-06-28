import { describe, expect, test } from "vite-plus/test";
import {
  convertExpenseEditorAmountToUnits,
  normalizeExpenseEditorAmount,
} from "./expenseEditorAmounts";

describe("normalizeExpenseEditorAmount", () => {
  test("preserves positive amount field values", () => {
    expect(normalizeExpenseEditorAmount(12.34)).toBe(12.34);
  });

  test("normalizes negative amount field values to zero", () => {
    expect(normalizeExpenseEditorAmount(-12.34)).toBe(0);
  });

  test("normalizes non-finite amount field values to zero", () => {
    expect(normalizeExpenseEditorAmount(Number.NaN)).toBe(0);
  });
});

describe("convertExpenseEditorAmountToUnits", () => {
  test("converts positive amounts to currency units", () => {
    expect(convertExpenseEditorAmountToUnits(12.34)).toBe(1234);
  });

  test("never converts negative amounts to negative units", () => {
    expect(convertExpenseEditorAmountToUnits(-12.34)).toBe(0);
  });
});
