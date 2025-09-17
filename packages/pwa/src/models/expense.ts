import {
  calculateLogStatsOfUser,
  type ExpenseInput,
  type ExpenseUser,
} from "#src/lib/expenses.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { ulid } from "ulidx";
import Dinero from "dinero.js";
import type { MediaFile } from "./media";
import { diff } from "@opentf/obj-diff";
import { patchMutate } from "#src/lib/patchMutate.ts";
import { clone } from "@opentf/std";
import { md5 } from "@takker/md5";
import type { PartyParticipant } from "./party";

export interface Expense {
  id: string;
  name: string;
  paidAt: Date;
  paidBy: Record<ExpenseUser, number>;
  shares: Record<ExpenseUser, ExpenseShare>;
  photos: MediaFile["id"][];
  __hash: string;
  __editCopy?: Omit<Expense, "__editCopy">;
  __editCopyLastUpdatedAt?: Date;
  __presence?: Record<
    ExpenseParticipantPresence["participantId"],
    ExpenseParticipantPresence
  >;
}

export type ExpenseShare = ExpenseShareExact | ExpenseShareDivide;

export interface ExpenseShareExact {
  type: "exact";
  value: number;
}

export interface ExpenseParticipantPresence {
  participantId: PartyParticipant["id"];
  dateTime: Date;
  elementId: string;
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

export function getExpenseTotalAmount(expense: Pick<Expense, "paidBy">) {
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

export function getExpenseUnitShares({
  shares,
  paidBy,
}: Pick<Expense, "shares" | "paidBy">) {
  const amountInUnits = getExpenseTotalAmount({ paidBy });
  const activeParticipants = Object.keys(shares);

  // Calculate total shares for divide participants (this is just a count, not money)
  const totalShares = activeParticipants.reduce((total, participantId) => {
    const share = shares[participantId];
    if (share?.type === "divide") {
      return total + share.value;
    }
    return total;
  }, 0);

  const participantAmounts = (() => {
    const totalAmount = Dinero({ amount: amountInUnits });

    // First, calculate the total amount taken by exact shares using Dinero.js
    const exactTotal = activeParticipants.reduce(
      (total, participantId) => {
        const share = shares[participantId];
        if (share?.type === "exact") {
          return total.add(Dinero({ amount: share.value }));
        }
        return total;
      },
      Dinero({ amount: 0 }),
    );

    // Remaining amount to be split among divide shares using Dinero.js
    const remainingAmount = totalAmount.subtract(exactTotal);

    // First pass: calculate proportional amounts
    const proportionalAmounts = activeParticipants.reduce(
      (acc, participantId) => {
        const share = shares[participantId];
        let participantAmount = 0;

        if (share?.type === "divide") {
          // Calculate using Dinero.js for precise division
          if (totalShares > 0) {
            const shareRatio = share.value / totalShares;
            const amountInUnits = remainingAmount.multiply(shareRatio);
            participantAmount = amountInUnits.getAmount();
          }
        } else if (share?.type === "exact") {
          // Exact shares are already in units
          participantAmount = share.value;
        }

        acc[participantId] = participantAmount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Second pass: distribute remaining cents to ensure total adds up exactly
    const totalCalculated = Object.values(proportionalAmounts).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const remainingCents = amountInUnits - totalCalculated;

    if (remainingCents !== 0) {
      // Find divide participants to distribute remaining cents
      const divideParticipants = activeParticipants.filter((participantId) => {
        const share = shares[participantId];
        return share?.type === "divide";
      });

      if (divideParticipants.length > 0) {
        // Sort participants by their current amount to distribute remaining cents
        // to those with the smallest amounts first (for positive remaining) or
        // to those with the largest amounts first (for negative remaining)
        const sortedParticipants = [...divideParticipants].sort((a, b) => {
          if (remainingCents > 0) {
            return proportionalAmounts[a] - proportionalAmounts[b];
          } else {
            return proportionalAmounts[b] - proportionalAmounts[a];
          }
        });

        // Distribute remaining cents one by one to divide participants
        const absRemainingCents = Math.abs(remainingCents);
        for (let i = 0; i < absRemainingCents; i++) {
          const participantIndex = i % sortedParticipants.length;
          const participantId = sortedParticipants[participantIndex];
          if (remainingCents > 0) {
            proportionalAmounts[participantId] += 1;
          } else {
            proportionalAmounts[participantId] -= 1;
          }
        }
      }
    }

    return proportionalAmounts;
  })();

  return participantAmounts;
}

export function getExpenseDiff(base: Expense, updated: Expense) {
  return diff(clone(base), clone(updated));
}

export function applyExpenseDiff(base: Expense, updated: Expense) {
  const expenseDiff = getExpenseDiff(base, updated);

  if (expenseDiff.length === 0) {
    return;
  }

  patchMutate(base, expenseDiff);
}

export function calculateExpenseHash(expense: Partial<Expense>) {
  const copy = clone(expense);

  delete copy.__hash;
  delete copy.__editCopy;
  delete copy.__editCopyLastUpdatedAt;

  return new TextDecoder().decode(md5(JSON.stringify(copy)));
}
