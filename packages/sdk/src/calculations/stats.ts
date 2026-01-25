/**
 * User statistics calculations.
 *
 * These functions calculate balance and debt statistics between users.
 */

import Dinero from "dinero.js";
import type { ExpenseUser } from "../models/expense.js";

// Re-export ExpenseUser for consumers
export type { ExpenseUser } from "../models/expense.js";

/**
 * Input format for expense calculations.
 * This represents a single expense payment with its distribution.
 */
export interface ExpenseInput {
  /** Version discriminator */
  version: 1;
  /** Who paid for this expense */
  paidBy: ExpenseUser;
  /** Map of users to the amounts they owe (in cents) */
  paidFor: Record<ExpenseUser, number>;
  /** Total expense amount in cents */
  expense: number;
}

/**
 * Difference statistics between two users.
 */
export interface UserDiff {
  /** The net difference in cents (positive means other user owes this user) */
  diffUnsplitted: Dinero.Dinero;
}

/**
 * Statistics for a user across all their expenses.
 */
export interface UserStats {
  /** Total amount this user owes to others */
  userOwes: Dinero.Dinero;
  /** Total amount owed to this user */
  owedToUser: Dinero.Dinero;
  /** Per-user debt breakdown */
  diffs: Record<string, UserDiff>;
  /** Net balance (positive = owed money, negative = owes money) */
  balance: Dinero.Dinero;
}

/**
 * Calculate statistics between two specific users.
 *
 * @param userUid - The first user's ID
 * @param otherUserUid - The second user's ID
 * @param expenses - Array of expense inputs
 * @returns The difference statistics between the two users
 */
export function calculateLogStatsBetweenTwoUsers(
  userUid: ExpenseUser,
  otherUserUid: ExpenseUser,
  expenses: ExpenseInput[],
): UserDiff {
  const groupedExpenses = expenses
    .filter(
      (expense) =>
        [userUid, otherUserUid].includes(expense.paidBy) &&
        ((expense.paidBy === userUid && otherUserUid in expense.paidFor) ||
          (expense.paidBy === otherUserUid && userUid in expense.paidFor)),
    )
    .reduce(
      (prev, next) => {
        const user = next.paidBy;
        const prevExpenses = prev[user] ?? [];

        return {
          ...prev,
          [user]: [...prevExpenses, next],
        };
      },
      {} as Record<string, ExpenseInput[]>,
    );

  const {
    [userUid]: userExpenses = [],
    [otherUserUid]: otherUserExpenses = [],
  } = groupedExpenses;

  // What U2 has to pay to U1
  const whatU2HasToPayToU1 = getSplitTotal(userExpenses, otherUserUid);

  // What U1 has to pay to U2
  const whatU1HasToPayToU2 = getSplitTotal(otherUserExpenses, userUid);

  const diff = whatU2HasToPayToU1.subtract(whatU1HasToPayToU2);

  return {
    diffUnsplitted: diff,
  };
}

/**
 * Calculate statistics for a user across all other users.
 *
 * @param userUid - The user to calculate stats for
 * @param listUsers - All users in the group
 * @param expenses - Array of expense inputs
 * @returns Complete statistics for the user
 */
export function calculateLogStatsOfUser(
  userUid: ExpenseUser,
  listUsers: ExpenseUser[],
  expenses: ExpenseInput[],
): UserStats {
  const diffs: Record<string, UserDiff> = {};

  for (const otherUserUid of listUsers.filter((uid) => uid !== userUid)) {
    diffs[otherUserUid] = calculateLogStatsBetweenTwoUsers(
      userUid,
      otherUserUid,
      expenses,
    );
  }

  const zero = Dinero({ amount: 0 });

  const userOwes = Object.values(diffs)
    .filter((diff) => diff.diffUnsplitted.lessThan(zero))
    .map((diff) => diff.diffUnsplitted)
    .reduce(
      (prev, next) => prev.add(Dinero({ amount: Math.abs(next.getAmount()) })),
      Dinero({ amount: 0 }),
    );

  const owedToUser = Object.values(diffs)
    .filter((diff) => diff.diffUnsplitted.greaterThan(zero))
    .map((diff) => diff.diffUnsplitted)
    .reduce((prev, next) => prev.add(next), Dinero({ amount: 0 }));

  return {
    userOwes,
    owedToUser,
    diffs,
    balance: owedToUser.subtract(userOwes),
  };
}

/**
 * Calculate the total split amount for a user from a list of expenses.
 */
function getSplitTotal(
  expenses: ExpenseInput[],
  uid: ExpenseUser,
  reverse = false,
): Dinero.Dinero {
  return expenses.reduce(
    (prev, next) => {
      let amount = Dinero({
        amount: next.expense,
      });

      amount = reverse
        ? Dinero({ amount: next.expense }).subtract(
            Dinero({ amount: next.paidFor[uid] }),
          )
        : Dinero({ amount: next.paidFor[uid] });

      return prev.add(amount);
    },
    Dinero({ amount: 0 }),
  );
}

/**
 * Convert a display amount (e.g., 10.50) to cents (1050).
 * Uses Math.round to avoid floating-point precision issues.
 *
 * @param amount - The display amount
 * @returns The amount in cents
 */
export function convertToUnits(amount: number): number {
  return Math.round(amount * 100);
}
