import { describe, expect, test } from "vite-plus/test";
import { expenseEditorSharesMatchAmount, getExpenseEditorUnitShares } from "./expenseEditor.ts";

describe("expense editor shares", () => {
  test("clamps a negative adjusted participant amount to zero", () => {
    const shares = {
      exact: { type: "exact" as const, value: 15_000 },
      adjusted: { type: "divide" as const, value: 1 },
    };

    expect(getExpenseEditorUnitShares(100, shares)).toStrictEqual({
      exact: 15_000,
      adjusted: 0,
    });
  });

  test("rejects a split that only balances with a negative participant amount", () => {
    const shares = {
      exact: { type: "exact" as const, value: 15_000 },
      adjusted: { type: "divide" as const, value: 1 },
    };

    expect(expenseEditorSharesMatchAmount(100, shares)).toBe(false);
  });

  test("accepts a valid non-negative split", () => {
    const shares = {
      exact: { type: "exact" as const, value: 5_000 },
      adjusted: { type: "divide" as const, value: 1 },
    };

    expect(expenseEditorSharesMatchAmount(100, shares)).toBe(true);
  });
});
