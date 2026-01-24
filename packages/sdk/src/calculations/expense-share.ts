/**
 * Expense sharing calculations.
 *
 * These functions handle converting expenses to the internal input format
 * and calculating how expenses are split among participants.
 */

import Dinero from "dinero.js";
import type {
  Expense,
  ExpenseUser,
  ExpenseShareExact,
  ExpenseShareDivide,
} from "../models/expense.js";
import { getExpenseTotalAmount } from "../models/expense.js";
import type { ExpenseInput } from "./stats.js";

/**
 * Convert an expense to the internal input format used for calculations.
 *
 * This function handles the conversion of expense shares (exact and divide types)
 * into a flat list of "who paid for whom" records, properly handling
 * multiple payers and rounding errors.
 *
 * @param expense - The expense to convert
 * @returns Array of expense inputs for calculation
 */
export function exportIntoInput(expense: Expense): ExpenseInput[] {
  if (Object.keys(expense.paidBy).length === 0) {
    console.warn("Noone paid for this Expense");
    return [];
  }

  // Validate that all paidBy values are integers
  for (const [user, amount] of Object.entries(expense.paidBy)) {
    if (!Number.isInteger(amount)) {
      throw new Error(
        `Invalid paidBy amount for user "${user}" in expense "${expense.id}": ` +
          `expected integer but got ${amount} (type: ${typeof amount}). ` +
          `This may indicate data corruption or a bug in expense creation.`,
      );
    }
  }

  // Validate that all share values are integers
  for (const [user, share] of Object.entries(expense.shares)) {
    if (!Number.isInteger(share.value)) {
      throw new Error(
        `Invalid share value for user "${user}" in expense "${expense.id}": ` +
          `expected integer but got ${share.value} (type: ${typeof share.value}). ` +
          `Share type: ${share.type}. ` +
          `This may indicate data corruption or a bug in expense creation.`,
      );
    }
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

/**
 * Calculate the share amounts for each participant in an expense.
 *
 * This function takes an expense and calculates the exact amount (in cents)
 * that each participant owes, handling both exact and divide share types.
 *
 * @param expense - The expense with shares and paidBy information
 * @returns A record mapping participant IDs to their amounts in cents
 */
export function getExpenseUnitShares({
  shares,
  paidBy,
}: Pick<Expense, "shares" | "paidBy">): Record<string, number> {
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
