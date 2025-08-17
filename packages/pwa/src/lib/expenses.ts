import Dinero from "dinero.js";

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
        userUid in expense.paidFor &&
        otherUserUid in expense.paidFor,
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

function getSplitTotal(
  expenses: ExpenseInput[],
  uid: ExpenseUser,
  reverse = false,
) {
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
  return String(amount).includes(".")
    ? Number(amount.toFixed(2).replace(".", ""))
    : amount * 100;
}
