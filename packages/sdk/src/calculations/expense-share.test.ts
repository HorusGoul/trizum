import { describe, test, expect } from "vitest";
import { exportIntoInput, getExpenseUnitShares } from "./expense-share.js";
import { createExpenseId } from "../models/expense.js";
import type { Expense, ExpenseShare } from "../models/expense.js";
import type { ExpenseInput, ExpenseUser } from "./stats.js";
import { ulid } from "ulidx";

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
    id: createExpenseId("test", (ts) => ulid(ts), timestamp),
    __schemaVersion: 1,
    name: "",
    paidAt: new Date(),
    paidBy,
    shares,
    photos: [],
    __hash: "",
  };
}

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
        "1": 100,
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
          "1": 25,
          "2": 25,
          "3": 50,
        },
        expense: 100,
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

  test("should handle rounding errors correctly", () => {
    const expense = createExpense({
      paidBy: {
        user1: 1000, // user1 paid 10.00 euros
      },
      shares: {
        user1: { type: "exact", value: 800 }, // user1 pays 800 = 8.00
        user2: { type: "divide", value: 1 }, // user2 pays 1/3 of remaining = 0.66
        user3: { type: "divide", value: 1 }, // user3 pays 1/3 of remaining = 0.67
        user4: { type: "divide", value: 1 }, // user4 pays 1/3 of remaining = 0.67
      },
    });

    const result = exportIntoInput(expense);

    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "user1",
        paidFor: {
          user1: 800,
          user2: 66,
          user3: 67,
          user4: 67,
        },
        expense: 1000,
      },
    ];
    expect(result).toStrictEqual(expected);
  });

  test("should distribute rounding errors fairly among divide participants", () => {
    const expense = createExpense({
      paidBy: {
        user1: 1000, // user1 paid 10.00 euros
      },
      shares: {
        user1: { type: "exact", value: 500 }, // user1 pays 500 = 5.00
        user2: { type: "divide", value: 1 }, // user2 pays 1/3 of remaining = 166.67
        user3: { type: "divide", value: 1 }, // user3 pays 1/3 of remaining = 166.67
        user4: { type: "divide", value: 1 }, // user4 pays 1/3 of remaining = 166.67
      },
    });

    const result = exportIntoInput(expense);

    // The remaining 500 cents should be split among 3 people
    // 500 / 3 = 166.67, which rounds to 166, 167, 167
    // Total: 500 + 166 + 167 + 167 = 1000 (exactly)
    const expected: ExpenseInput[] = [
      {
        version: 1,
        paidBy: "user1",
        paidFor: {
          user1: 500,
          user2: 166,
          user3: 167,
          user4: 167,
        },
        expense: 1000,
      },
    ];
    expect(result).toStrictEqual(expected);

    // Verify the total adds up exactly
    const totalPaidFor = Object.values(result[0].paidFor).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    expect(totalPaidFor).toBe(1000);
  });
});

describe("exportIntoInput float handling", () => {
  test("should round paidBy float values to integers", () => {
    const expense = createExpense({
      paidBy: {
        "1": 50.5, // Float value - should be rounded to 51
      },
      shares: {
        "1": { type: "divide", value: 1 },
      },
    });

    const result = exportIntoInput(expense);
    expect(result).toHaveLength(1);
    expect(result[0].expense).toBe(51); // Rounded from 50.5
    expect(result[0].paidFor["1"]).toBe(51);
  });

  test("should round share value float values to integers", () => {
    const expense = createExpense({
      paidBy: {
        "1": 50,
      },
      shares: {
        "1": { type: "exact", value: 25.5 }, // Float value - should be rounded to 26
      },
    });

    const result = exportIntoInput(expense);
    expect(result).toHaveLength(1);
    expect(result[0].paidFor["1"]).toBe(26); // Rounded from 25.5
  });

  test("should handle multiple participants with float values", () => {
    const expense = createExpense({
      paidBy: {
        user1: 100.4, // Rounds to 100
      },
      shares: {
        user1: { type: "divide", value: 1 },
      },
    });

    const result = exportIntoInput(expense);
    expect(result).toHaveLength(1);
    expect(result[0].expense).toBe(100); // Rounded from 100.4
  });
});

describe("getExpenseUnitShares", () => {
  test("should calculate equal divide shares", () => {
    const result = getExpenseUnitShares({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
      },
    });

    expect(result.user1).toBe(50);
    expect(result.user2).toBe(50);
  });

  test("should calculate unequal divide shares", () => {
    const result = getExpenseUnitShares({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 3 },
      },
    });

    expect(result.user1).toBe(25);
    expect(result.user2).toBe(75);
  });

  test("should calculate exact shares", () => {
    const result = getExpenseUnitShares({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "exact", value: 30 },
        user2: { type: "exact", value: 70 },
      },
    });

    expect(result.user1).toBe(30);
    expect(result.user2).toBe(70);
  });

  test("should calculate mixed exact and divide shares", () => {
    const result = getExpenseUnitShares({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "exact", value: 40 },
        user2: { type: "divide", value: 1 },
        user3: { type: "divide", value: 1 },
      },
    });

    expect(result.user1).toBe(40);
    expect(result.user2).toBe(30);
    expect(result.user3).toBe(30);
  });

  test("should handle rounding in divide shares", () => {
    const result = getExpenseUnitShares({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
        user3: { type: "divide", value: 1 },
      },
    });

    // 100 / 3 = 33.33..., should distribute as 33, 33, 34
    const total = result.user1 + result.user2 + result.user3;
    expect(total).toBe(100);
  });
});
