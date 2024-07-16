import { describe, test, expect } from "vitest";
import { exportIntoInput, type Expense, type ExpenseShare } from "./expense";
import type { ExpenseInput, ExpenseUser } from "#src/lib/expenses.js";

describe("exportIntoInput(Expense): ExpenseInput[]", () => {
  test("single exact", () => {
    const expense = createExpense({
      paidBy: {
        "1": 50,
      },
      shares: {
        "1": { type: "exact", value: 10 },
        "2": { type: "exact", value: 25 },
        "3": { type: "exact", value: 15 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 10,
          "2": 25,
          "3": 15,
        },
        expense: 50,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
  test("single divide", () => {
    const expense = createExpense({
      paidBy: {
        "1": 10,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 2 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 2.5,
          "2": 2.5,
          "3": 5,
        },
        expense: 10,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
  test("single exact + divide", () => {
    const expense = createExpense({
      paidBy: {
        "1": 40,
      },
      shares: {
        "1": { type: "exact", value: 10 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 2 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 10,
          "2": 10,
          "3": 20,
        },
        expense: 40,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
  test("multiple exact", () => {
    const expense = createExpense({
      paidBy: {
        "1": 40,
        "2": 20,
      },
      shares: {
        "1": { type: "exact", value: 21 },
        "2": { type: "exact", value: 9 },
        "3": { type: "exact", value: 30 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 14,
          "2": 6,
          "3": 20,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 7,
          "2": 3,
          "3": 10,
        },
        expense: 20,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
  test("multiple divide", () => {
    const expense = createExpense({
      paidBy: {
        "1": 40,
        "2": 20,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 2 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 10,
          "2": 10,
          "3": 20,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 5,
          "2": 5,
          "3": 10,
        },
        expense: 20,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
  test("multiple exact + divide", () => {
    const expense = createExpense({
      paidBy: {
        "1": 40,
        "2": 20,
      },
      shares: {
        "1": { type: "exact", value: 6 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 2 },
      },
    });
    const result = exportIntoInput(expense);
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "1",
        paidFor: {
          "1": 4,
          "2": 12,
          "3": 24,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 2,
          "2": 6,
          "3": 12,
        },
        expense: 20,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
});

function createExpense({
  paidBy,
  shares,
}: {
  paidBy: Record<ExpenseUser, number>;
  shares: Record<ExpenseUser, ExpenseShare>;
}): Expense {
  return {
    name: "",
    description: "",
    paidAt: new Date(),
    paidBy,
    shares,
  };
}
