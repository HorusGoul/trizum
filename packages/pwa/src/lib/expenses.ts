import { createMoney as Dinero } from "#src/lib/money.js";

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

  const diff = whatU2HasToPayToU1.subtract(whatU1HasToPayToU2);

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

  const zero = Dinero({ amount: 0 });

  let userOwes = Dinero({ amount: 0 });
  let owedToUser = Dinero({ amount: 0 });

  for (const diff of Object.values(diffs)) {
    if (diff.diffUnsplitted.lessThan(zero)) {
      userOwes = userOwes.add(Dinero({ amount: Math.abs(diff.diffUnsplitted.getAmount()) }));
    } else if (diff.diffUnsplitted.greaterThan(zero)) {
      owedToUser = owedToUser.add(diff.diffUnsplitted);
    }
  }

  return {
    userOwes,
    owedToUser,
    diffs,
    balance: owedToUser.subtract(userOwes),
  };
}

function getSplitTotal(expenses: ExpenseInput[], uid: ExpenseUser, reverse = false) {
  return expenses.reduce(
    (prev, next) => {
      let amount = Dinero({
        amount: next.expense,
      });

      amount = reverse
        ? Dinero({ amount: next.expense }).subtract(Dinero({ amount: next.paidFor[uid] }))
        : Dinero({ amount: next.paidFor[uid] });

      return prev.add(amount);
    },
    Dinero({ amount: 0 }),
  );
}

export function convertToUnits(amount: number) {
  // Convert display amount (e.g., 10.50) to cents (1050)
  // Use Math.round to avoid floating-point precision issues
  return Math.round(amount * 100);
}
