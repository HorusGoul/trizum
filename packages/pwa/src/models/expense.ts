import type { Expense, BalancesByParticipant } from "@trizum/sdk";
import {
  // Re-export calculation functions from SDK
  exportIntoInput as sdkExportIntoInput,
  getExpenseUnitShares as sdkGetExpenseUnitShares,
  getImpactOnBalanceForUser as sdkGetImpactOnBalanceForUser,
  calculateBalancesByParticipant as sdkCalculateBalancesByParticipant,
  // Functions that already existed in SDK
  createExpenseId as sdkCreateExpenseId,
  decodeExpenseId,
  findExpenseById,
  getExpenseTotalAmount,
  simplifyBalanceTransactions,
  mergeBalancesByParticipant,
  // Operations utilities from SDK
  calculateExpenseHash as sdkCalculateExpenseHash,
} from "@trizum/sdk";
import { ulid } from "ulidx";
import type { Party, PartyParticipant } from "./party";

// Re-export types from SDK
export type {
  Expense,
  ExpenseShare,
  ExpenseShareExact,
  ExpenseShareDivide,
  Balance,
  BalancesByParticipant,
  SimplifiedTransaction,
  ExpenseUser,
} from "@trizum/sdk";

// Re-export functions from SDK
export {
  decodeExpenseId,
  findExpenseById,
  getExpenseTotalAmount,
  simplifyBalanceTransactions,
  mergeBalancesByParticipant,
};

// PWA-specific types
export interface ExpenseParticipantPresence {
  participantId: PartyParticipant["id"];
  dateTime: Date;
  elementId: string;
}

// Re-export SDK functions with SDK-compatible signatures
export const exportIntoInput = sdkExportIntoInput;
export const getExpenseUnitShares = sdkGetExpenseUnitShares;
export const getImpactOnBalanceForUser = sdkGetImpactOnBalanceForUser;
export const calculateExpenseHash = sdkCalculateExpenseHash;

/**
 * Calculate balances for all participants from a list of expenses.
 * Re-exports SDK function with PWA-compatible signature.
 */
export function calculateBalancesByParticipant(
  expenses: Expense[],
  partyParticipants: Party["participants"],
): BalancesByParticipant {
  return sdkCalculateBalancesByParticipant(expenses, partyParticipants);
}

/**
 * Create a unique expense ID.
 * PWA-specific wrapper that uses ulidx internally.
 */
export function createExpenseId(chunkId: string, timestamp?: number): string {
  return sdkCreateExpenseId(chunkId, (ts) => ulid(ts), timestamp);
}
