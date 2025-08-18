import {
  calculateLogStatsOfUser,
  type ExpenseInput,
  type ExpenseUser,
} from "#src/lib/expenses.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { ulid } from "ulidx";
import Dinero from "dinero.js";

export interface Expense {
  id: string;
  name: string;
  paidAt: Date;
  paidBy: Record<ExpenseUser, number>;
  shares: Record<ExpenseUser, ExpenseShare>;
}

export type ExpenseShare = ExpenseShareExact | ExpenseShareDivide;

export interface ExpenseShareExact {
  type: "exact";
  value: number;
}

export interface ExpenseShareDivide {
  type: "divide";
  value: number;
  calculatedExact?: number;
}

export function exportIntoInput(expense: Expense): ExpenseInput[] {
  if (Object.keys(expense.paidBy).length === 0) {
    console.warn("Noone paid for this Expense");
    return [];
  }

  const total = Object.values(expense.paidBy).reduce(
    (acc, curr) => acc.add(Dinero({ amount: curr })),
    Dinero({ amount: 0 }),
  );

  return Object.keys(expense.paidBy).map((user): ExpenseInput => {
    const partial = expense.paidBy[user];
    const factor = partial / total.getAmount();
    const paidFor: Record<ExpenseUser, number> = {};
    let amountLeft = Dinero({ amount: partial });

    const exacts: Record<ExpenseUser, ExpenseShareExact> = Object.keys(
      expense.shares,
    )
      .filter((share) => expense.shares[share].type === "exact")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});

    const divides: Record<ExpenseUser, ExpenseShareDivide> = Object.keys(
      expense.shares,
    )
      .filter((share) => expense.shares[share].type === "divide")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});

    for (const exact of Object.keys(exacts)) {
      const amount = Dinero({ amount: exacts[exact].value }).multiply(factor);
      paidFor[exact] = amount.getAmount();
      amountLeft = amountLeft.subtract(amount);
    }

    if (amountLeft.getAmount() < 0) {
      console.error("Negative amounts left");
    }

    const totalDivides = Object.values(divides).reduce(
      (acc, curr) => acc + curr.value,
      0,
    );

    if (totalDivides > 0) {
      const totalLeftForDivides = amountLeft.getAmount();
      const divideUsers = Object.keys(divides);

      // Calculate divide shares with proper rounding
      let distributedTotal = 0;
      const divideAmounts: Record<ExpenseUser, number> = {};

      // First pass: calculate initial amounts
      for (const divide of divideUsers) {
        const dFactor = divides[divide].value / totalDivides;
        const amount = Math.round(totalLeftForDivides * dFactor);
        divideAmounts[divide] = amount;
        distributedTotal += amount;
      }

      // Second pass: adjust for rounding errors
      const roundingError = totalLeftForDivides - distributedTotal;
      if (roundingError !== 0 && divideUsers.length > 0) {
        // Distribute rounding error more fairly among divide participants
        const absRoundingError = Math.abs(roundingError);

        // Sort participants by their current amount to distribute rounding errors
        // to those with the smallest amounts first (for positive error) or
        // to those with the largest amounts first (for negative error)
        const sortedDivideUsers = [...divideUsers].sort((a, b) => {
          if (roundingError > 0) {
            return divideAmounts[a] - divideAmounts[b];
          } else {
            return divideAmounts[b] - divideAmounts[a];
          }
        });

        // Distribute rounding error one by one to divide participants
        for (let i = 0; i < absRoundingError; i++) {
          const participantIndex = i % sortedDivideUsers.length;
          const participantId = sortedDivideUsers[participantIndex];
          if (roundingError > 0) {
            divideAmounts[participantId] += 1;
          } else {
            divideAmounts[participantId] -= 1;
          }
        }
      }

      // Apply the calculated amounts
      for (const divide of divideUsers) {
        paidFor[divide] = divideAmounts[divide];
        amountLeft = amountLeft.subtract(
          Dinero({ amount: divideAmounts[divide] }),
        );
      }
    }

    return {
      version: 1,
      paidBy: user,
      expense: partial,
      paidFor,
    };
  });
}

export function createExpenseId(chunkId: string, timestamp?: number): string {
  return `${ulid(timestamp)}:${chunkId}`;
}

export function decodeExpenseId(expenseId: string): {
  chunkId: DocumentId;
  expenseId: string;
} {
  const [id, chunkId] = expenseId.split(":");
  return { chunkId: chunkId as DocumentId, expenseId: id };
}

/**
 * Find an expense by its ID.
 *
 * This function uses a binary search to find the expense with the given ID
 * within the given array of expenses.
 *
 * This is the best way to find expenses within chunks.
 *
 * @param expenses The array of expenses to search in, must be sorted in descending order.
 * @param encodedId The encoded ID of the expense to find.
 */
export function findExpenseById(
  expenses: Expense[],
  encodedId: string,
): [Expense | undefined, index: number] {
  const { expenseId } = decodeExpenseId(encodedId);

  let start = 0;
  let end = expenses.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const expense = expenses[mid];
    const { expenseId: midExpenseId } = decodeExpenseId(expense.id);

    if (midExpenseId === expenseId) {
      return [expense, mid];
    }

    if (midExpenseId > expenseId) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return [undefined, -1];
}

export function getExpenseTotalAmount(expense: Expense) {
  return Object.values(expense.paidBy).reduce((acc, curr) => acc + curr, 0);
}

export function getImpactOnBalanceForUser(expense: Expense, userId: string) {
  const input = exportIntoInput(expense);

  const { userOwes, owedToUser } = calculateLogStatsOfUser(
    userId,
    Object.keys(expense.shares),
    input,
  );

  return owedToUser.subtract(userOwes).getAmount();
}
