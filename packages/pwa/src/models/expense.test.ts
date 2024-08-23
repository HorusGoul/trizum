import { describe, test, expect } from "vitest";
import {
  createExpenseId,
  exportIntoInput,
  findExpenseById,
  type Expense,
  type ExpenseShare,
} from "./expense";
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
          "1": 0.2,
          "2": 0.5,
          "3": 0.3,
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
          "1": 0.25,
          "2": 0.25,
          "3": 0.5,
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
          "1": 0.25,
          "2": 0.25,
          "3": 0.5,
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
          "1": 0.35,
          "2": 0.15,
          "3": 0.5,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 0.35,
          "2": 0.15,
          "3": 0.5,
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
          "1": 0.25,
          "2": 0.25,
          "3": 0.5,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 0.25,
          "2": 0.25,
          "3": 0.5,
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
          "1": 0.1,
          "2": 0.3,
          "3": 0.6,
        },
        expense: 40,
      },
      {
        version: 1,
        paidBy: "2",
        paidFor: {
          "1": 0.1,
          "2": 0.3,
          "3": 0.6,
        },
        expense: 20,
      },
    ];
    expect(result).toStrictEqual(expected);
  });
});

describe("findExpenseById", () => {
  function createMockExpense(timestamp?: number) {
    return createExpense(
      {
        paidBy: {
          "1": 50,
        },
        shares: {
          "1": { type: "exact", value: 10 },
          "2": { type: "exact", value: 25 },
          "3": { type: "exact", value: 15 },
        },
      },
      timestamp,
    );
  }

  const expenses = Array.from({ length: 500 }, (_, index) => {
    return createMockExpense(index);
  }).reverse();

  test("finds a random expense at the first half", () => {
    const expense = expenses[100];
    const [result, index] = findExpenseById(expenses, expense.id);

    expect(result).toStrictEqual(expense);
    expect(index).toBe(100);
  });

  test("finds a random expense at the second half", () => {
    const expense = expenses[300];
    const [result, index] = findExpenseById(expenses, expense.id);

    expect(result).toStrictEqual(expense);
    expect(index).toBe(300);
  });

  test("finds first expense", () => {
    const expense = expenses[0];
    const [result, index] = findExpenseById(expenses, expense.id);

    expect(result).toStrictEqual(expense);
    expect(index).toBe(0);
  });

  test("finds last expense", () => {
    const expense = expenses.at(-1)!;
    const [result, index] = findExpenseById(expenses, expense.id);

    expect(result).toStrictEqual(expense);
    expect(index).toBe(499);
  });

  test("finds expense when list only has one item", () => {
    const expense = createMockExpense();
    const expenses = [expense];

    const [result, index] = findExpenseById(expenses, expense.id);

    expect(result).toStrictEqual(expense);
    expect(index).toBe(0);
  });
});

function createExpense(
  {
    paidBy,
    shares,
  }: {
    paidBy: Record<ExpenseUser, number>;
    shares: Record<ExpenseUser, ExpenseShare>;
  },
  timestamp?: number,
): Expense {
  return {
    id: createExpenseId("test", timestamp),
    name: "",
    description: "",
    paidAt: new Date(),
    paidBy,
    shares,
  };
}
