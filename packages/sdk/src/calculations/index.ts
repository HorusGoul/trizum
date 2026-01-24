/**
 * Calculations module for expense splitting and balance calculations.
 *
 * This module contains all the business logic for calculating how expenses
 * are split among participants and what each participant owes or is owed.
 */

// Statistics
export {
  calculateLogStatsBetweenTwoUsers,
  calculateLogStatsOfUser,
  convertToUnits,
  type ExpenseInput,
  type UserDiff,
  type UserStats,
  type ExpenseUser,
} from "./stats.js";

// Expense sharing
export { exportIntoInput, getExpenseUnitShares } from "./expense-share.js";

// Balance calculations
export {
  calculateBalancesByParticipant,
  getImpactOnBalanceForUser,
} from "./balance.js";
