import { describe, expect, test } from "vite-plus/test";
import {
  expenseEditorSharesMatchAmount,
  getExpenseEditorUnitShares,
  getExpenseEditorValidationIssues,
  getExpenseEditorValidationResult,
  type ExpenseEditorValidationValues,
} from "./expenseEditor.ts";

const completeExpense: ExpenseEditorValidationValues = {
  name: "Dinner",
  amount: 100,
  paidBy: "payer",
  shares: {
    participant: { type: "divide", value: 1 },
  },
};

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

  test("returns a form-wide error with minor-unit totals for an invalid split", () => {
    const values: ExpenseEditorValidationValues = {
      ...completeExpense,
      shares: {
        exact: { type: "exact", value: 15_000 },
        adjusted: { type: "divide", value: 1 },
      },
    };

    expect(getExpenseEditorValidationIssues(values)).toStrictEqual([
      {
        code: "shares-total-mismatch",
        severity: "error",
        expenseAmount: 10_000,
        sharesTotal: 15_000,
      },
    ]);
  });

  test("does not report a split mismatch before participants are selected", () => {
    expect(
      getExpenseEditorValidationIssues({
        ...completeExpense,
        shares: {},
      }),
    ).toStrictEqual([]);
  });
});

describe("expense editor validation status", () => {
  test("starts pristine when a valid create form has not changed", () => {
    expect(
      getExpenseEditorValidationResult(completeExpense, { isDirty: false, mode: "create" }),
    ).toMatchObject({
      issues: [],
      status: "pristine",
    });
  });

  test("validates an existing expense before it changes", () => {
    expect(
      getExpenseEditorValidationResult(completeExpense, { isDirty: false, mode: "edit" }),
    ).toMatchObject({
      issues: [],
      status: "valid",
    });
  });

  test("reports an incomplete existing expense before it changes", () => {
    expect(
      getExpenseEditorValidationResult(
        {
          ...completeExpense,
          name: "",
        },
        { isDirty: false, mode: "edit" },
      ),
    ).toMatchObject({ issues: [], status: "incomplete" });
  });

  test("is incomplete when required values are missing", () => {
    expect(
      getExpenseEditorValidationResult(
        {
          ...completeExpense,
          name: "",
          amount: 0,
          shares: {},
        },
        { isDirty: true, mode: "create" },
      ),
    ).toMatchObject({ issues: [], status: "incomplete" });
  });

  test.each(["create", "edit"] as const)(
    "blocks %s submission when no participants are selected",
    (mode) => {
      expect(
        getExpenseEditorValidationResult(
          {
            ...completeExpense,
            shares: {},
          },
          { isDirty: true, mode },
        ),
      ).toMatchObject({ issues: [], status: "incomplete" });
    },
  );

  test("is valid when required values and form-wide checks pass", () => {
    expect(
      getExpenseEditorValidationResult(completeExpense, { isDirty: true, mode: "create" }),
    ).toMatchObject({ issues: [], status: "valid" });
  });

  test("surfaces form-wide errors even before the form becomes dirty", () => {
    expect(
      getExpenseEditorValidationResult(
        {
          ...completeExpense,
          shares: {
            exact: { type: "exact", value: 15_000 },
            adjusted: { type: "divide", value: 1 },
          },
        },
        { isDirty: false, mode: "create" },
      ),
    ).toMatchObject({
      issues: [{ code: "shares-total-mismatch", severity: "error" }],
      status: "error",
    });
  });
});
