/**
 * Expense calculation utilities.
 * Re-exports SDK functions with PWA-compatible types.
 */

export {
  calculateLogStatsBetweenTwoUsers,
  calculateLogStatsOfUser,
  convertToUnits,
  type ExpenseInput,
  type UserDiff,
  type UserStats,
} from "@trizum/sdk";

// For backwards compatibility, keep ExpenseUser type export
export type { ExpenseUser } from "@trizum/sdk";
