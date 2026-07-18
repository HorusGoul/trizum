import { add, greaterThan, lessThan, subtract } from "dinero.js";
import { createMoney, getMoneyAmount } from "./money.ts";

export type ExpenseUser = string;

export interface ExpenseInput {
  version: 1;
  paidBy: ExpenseUser;

  /**
   * A map of the users that will owe money to the paidBy user.
   *
   * Values are in units of cents.
   */
  paidFor: Record<ExpenseUser, number>;
  expense: number;
}

export function calculateLogStatsBetweenTwoUsers(
  userUid: ExpenseUser,
  otherUserUid: ExpenseUser,
  expenses: ExpenseInput[],
) {
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

  const { [userUid]: userExpenses = [], [otherUserUid]: otherUserExpenses = [] } = groupedExpenses;

  /**
   * What U2 has to pay to U1
   */
  const whatU2HasToPayToU1 = getSplitTotal(userExpenses, otherUserUid);

  /**
   * What U1 has to pay to U2
   */
  const whatU1HasToPayToU2 = getSplitTotal(otherUserExpenses, userUid);

  const diff = subtract(whatU2HasToPayToU1, whatU1HasToPayToU2);

  return {
    diffUnsplitted: diff,
  };
}

type UserDiff = ReturnType<typeof calculateLogStatsBetweenTwoUsers>;

export function calculateLogStatsOfUser(
  userUid: ExpenseUser,
  listUsers: ExpenseUser[],
  expenses: ExpenseInput[],
) {
  const diffs: Record<string, UserDiff> = {};

  for (const otherUserUid of listUsers.filter((uid) => uid !== userUid)) {
    diffs[otherUserUid] = calculateLogStatsBetweenTwoUsers(userUid, otherUserUid, expenses);
  }

  const zero = createMoney(0);

  let userOwes = createMoney(0);
  let owedToUser = createMoney(0);

  for (const diff of Object.values(diffs)) {
    if (lessThan(diff.diffUnsplitted, zero)) {
      userOwes = add(userOwes, createMoney(Math.abs(getMoneyAmount(diff.diffUnsplitted))));
    } else if (greaterThan(diff.diffUnsplitted, zero)) {
      owedToUser = add(owedToUser, diff.diffUnsplitted);
    }
  }

  return {
    userOwes,
    owedToUser,
    diffs,
    balance: subtract(owedToUser, userOwes),
  };
}

function getSplitTotal(expenses: ExpenseInput[], uid: ExpenseUser) {
  return expenses.reduce((prev, next) => {
    const amount = createMoney(next.paidFor[uid]);

    return add(prev, amount);
  }, createMoney(0));
}

export function convertToUnits(amount: number) {
  // Convert display amount (e.g., 10.50) to cents (1050)
  // Use Math.round to avoid floating-point precision issues
  return Math.round(amount * 100);
}

export function convertFromUnits(amount: number) {
  return amount / 100;
}
