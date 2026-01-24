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
} from "@trizum/sdk";
import { ulid } from "ulidx";
import { diff } from "@opentf/obj-diff";
import { patchMutate } from "#src/lib/patchMutate.ts";
import { clone } from "@opentf/std";
import { md5 } from "@takker/md5";
import type { Party, PartyParticipant } from "./party";
import { assertNever } from "#src/lib/assertNever.ts";

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

// PWA-specific functions that use PWA dependencies

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

  const input = [
    copy.id,
    copy.name,
    copy.paidAt?.toISOString() || "",
    Object.entries(copy.paidBy ?? {})
      .map(([key, value]) => `${key}:${value}`)
      .join(","),
    Object.entries(copy.shares ?? {})
      .map(([key, share]) => {
        switch (share.type) {
          case "exact":
          case "divide":
            return `${key}:${share.type}:${share.value}`;
          default:
            assertNever(share);
        }
      })
      .join(","),
    copy.photos?.join(","),
  ].join("");

  const hash = md5(input);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}
