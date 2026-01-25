/**
 * Balance calculations.
 *
 * These functions calculate balances for participants across expenses.
 */

import type {
  Expense,
  Balance,
  BalancesByParticipant,
} from "../models/expense.js";
import type { Party } from "../models/party.js";
import { calculateLogStatsOfUser } from "./stats.js";
import { exportIntoInput } from "./expense-share.js";

/**
 * Calculate balances for all participants from a list of expenses.
 *
 * @param expenses - Array of expenses to calculate from
 * @param partyParticipants - Record of participant IDs to participant objects
 * @returns Balances indexed by participant ID
 */
export function calculateBalancesByParticipant(
  expenses: Expense[],
  partyParticipants: Party["participants"],
): BalancesByParticipant {
  const inputs = expenses.flatMap(exportIntoInput);
  const participantIds = Object.keys(partyParticipants);

  const balances = participantIds.map((participantId) => {
    const dineroStats = calculateLogStatsOfUser(
      participantId,
      participantIds,
      inputs,
    );

    return {
      participantId,
      stats: {
        userOwes: dineroStats.userOwes.getAmount(),
        owedToUser: dineroStats.owedToUser.getAmount(),
        diffs: Object.fromEntries(
          Object.entries(dineroStats.diffs).map(([participantId, diff]) => [
            participantId,
            {
              diffUnsplitted: diff.diffUnsplitted.getAmount(),
            },
          ]),
        ),
        balance: dineroStats.balance.getAmount(),
      },
      visualRatio: 0,
    };
  });

  const withVisualRatios = calculateVisualRatioForBalances(balances);

  return Object.fromEntries(
    withVisualRatios.map((balance) => [balance.participantId, balance]),
  );
}

/**
 * Calculate the impact on balance for a specific user from an expense.
 *
 * @param expense - The expense to analyze
 * @param userId - The user ID to calculate impact for
 * @returns The impact in cents (positive = user is owed, negative = user owes)
 */
export function getImpactOnBalanceForUser(
  expense: Expense,
  userId: string,
): number {
  const input = exportIntoInput(expense);
  const expenseParticipantsIds = [
    ...Object.keys(expense.paidBy),
    ...Object.keys(expense.shares),
  ];

  const { userOwes, owedToUser } = calculateLogStatsOfUser(
    userId,
    expenseParticipantsIds,
    input,
  );

  return owedToUser.subtract(userOwes).getAmount();
}

/**
 * Calculate visual ratios for balances.
 * The visual ratio is used for UI display, showing relative balance sizes.
 *
 * @param balances - Array of balances to process
 * @returns Balances with visual ratios calculated
 */
function calculateVisualRatioForBalances(balances: Balance[]): Balance[] {
  if (balances.length === 0) {
    return balances;
  }

  const biggestAbsoluteBalance = balances.reduce((prev, next) => {
    const prevAbs = Math.abs(prev.stats.balance);
    const nextAbs = Math.abs(next.stats.balance);

    return prevAbs > nextAbs ? prev : next;
  });

  // Biggest absolute balance should be considered as the reference point (1)
  const referenceBalance = biggestAbsoluteBalance.stats.balance;

  // Use the reference balance to calculate the visual ratio of each balance
  for (const balance of balances) {
    balance.visualRatio =
      referenceBalance !== 0 ? balance.stats.balance / referenceBalance : 0;
  }

  return balances;
}
