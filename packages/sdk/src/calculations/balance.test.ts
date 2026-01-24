import { describe, test, expect } from "vitest";
import {
  getImpactOnBalanceForUser,
  calculateBalancesByParticipant,
} from "./balance.js";
import { createExpenseId } from "../models/expense.js";
import type { Expense, ExpenseShare } from "../models/expense.js";
import type { ExpenseUser } from "./stats.js";
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

describe("getImpactOnBalanceForUser", () => {
  test("should calculate correct impact for reimbursement", () => {
    const expense = createExpense({
      paidBy: {
        user1: 28942, // 289.42 euros in cents
      },
      shares: {
        user2: { type: "exact", value: 28942 },
      },
    });

    const impact = getImpactOnBalanceForUser(expense, "user2");

    // When user1 pays for user2 (reimbursement), user2's balance impact should be negative
    // because someone else paid for them
    expect(impact).toBe(-28942);
  });

  test("should calculate correct impact for expense where user pays", () => {
    const expense = createExpense({
      paidBy: {
        user1: 10000, // 100.00 euros in cents
      },
      shares: {
        user1: { type: "exact", value: 5000 }, // 50.00 euros
        user2: { type: "exact", value: 5000 }, // 50.00 euros
      },
    });

    const impact = getImpactOnBalanceForUser(expense, "user1");

    // user1 pays 100 but only owes 50, so net impact should be +50 (out of pocket)
    expect(impact).toBe(5000);
  });

  test("should calculate correct impact for expense where user receives money", () => {
    const expense = createExpense({
      paidBy: {
        user1: 10000, // 100.00 euros in cents
      },
      shares: {
        user2: { type: "exact", value: 6000 }, // 60.00 euros
        user1: { type: "exact", value: 4000 }, // 40.00 euros
      },
    });

    const impact = getImpactOnBalanceForUser(expense, "user2");

    // user2 receives 60 but owes 0, so net impact should be -60 (receiving money)
    expect(impact).toBe(-6000);
  });

  test("should calculate zero impact when user is not involved", () => {
    const expense = createExpense({
      paidBy: {
        user1: 10000, // 100.00 euros in cents
      },
      shares: {
        user2: { type: "exact", value: 10000 }, // 100.00 euros
      },
    });

    const impact = getImpactOnBalanceForUser(expense, "user3");

    // user3 is not involved in this expense, so impact should be 0
    expect(impact).toBe(0);
  });
});

describe("calculateBalancesByParticipant", () => {
  test("should calculate balances for simple expense", () => {
    const expense = createExpense({
      paidBy: {
        user1: 100,
      },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
      },
    });

    const participants = {
      user1: { id: "user1", name: "User 1" },
      user2: { id: "user2", name: "User 2" },
    };

    const balances = calculateBalancesByParticipant([expense], participants);

    expect(balances.user1.stats.balance).toBe(50);
    expect(balances.user2.stats.balance).toBe(-50);
  });

  test("should handle multiple expenses", () => {
    const expense1 = createExpense({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
      },
    });

    const expense2 = createExpense({
      paidBy: { user2: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
      },
    });

    const participants = {
      user1: { id: "user1", name: "User 1" },
      user2: { id: "user2", name: "User 2" },
    };

    const balances = calculateBalancesByParticipant(
      [expense1, expense2],
      participants,
    );

    // Both paid 100 and split 50/50, so balances should be 0
    expect(balances.user1.stats.balance).toBe(0);
    expect(balances.user2.stats.balance).toBe(0);
  });

  test("should calculate visual ratios", () => {
    const expense = createExpense({
      paidBy: { user1: 100 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
      },
    });

    const participants = {
      user1: { id: "user1", name: "User 1" },
      user2: { id: "user2", name: "User 2" },
    };

    const balances = calculateBalancesByParticipant([expense], participants);

    // Visual ratios are relative to the largest absolute balance
    // user1 has +50, user2 has -50
    // The largest absolute is 50 (from user1), so ratios are relative to 50
    // user1: 50/50 = 1, user2: -50/50 = -1
    expect(Math.abs(balances.user1.visualRatio)).toBe(1);
    expect(Math.abs(balances.user2.visualRatio)).toBe(1);
    // They should have opposite signs
    expect(balances.user1.visualRatio * balances.user2.visualRatio).toBe(-1);
  });

  test("should handle three participants", () => {
    const expense = createExpense({
      paidBy: { user1: 90 },
      shares: {
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 1 },
        user3: { type: "divide", value: 1 },
      },
    });

    const participants = {
      user1: { id: "user1", name: "User 1" },
      user2: { id: "user2", name: "User 2" },
      user3: { id: "user3", name: "User 3" },
    };

    const balances = calculateBalancesByParticipant([expense], participants);

    // user1 paid 90, each owes 30
    // user1 balance: paid 90, owes 30 = +60
    // user2 balance: paid 0, owes 30 = -30
    // user3 balance: paid 0, owes 30 = -30
    expect(balances.user1.stats.balance).toBe(60);
    expect(balances.user2.stats.balance).toBe(-30);
    expect(balances.user3.stats.balance).toBe(-30);
  });
});
