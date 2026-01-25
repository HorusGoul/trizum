/**
 * Expense model and related types.
 */

import type { DocumentId } from "../types.js";
import type { MediaFile } from "./media.js";

/**
 * Unique identifier for an expense participant within a party.
 */
export type ExpenseUser = string;

/**
 * An expense record within a party.
 */
export interface Expense {
  /** Unique expense ID (format: ulid:chunkId) */
  id: string;
  /** Schema version for migrations (optional, defaults to 0 if missing) */
  __schemaVersion?: number;
  /** Description of the expense */
  name: string;
  /** When the expense was paid */
  paidAt: Date;
  /** Who paid and how much (in cents) */
  paidBy: Record<ExpenseUser, number>;
  /** How the expense is split among participants */
  shares: Record<ExpenseUser, ExpenseShare>;
  /** Associated receipt photos */
  photos: MediaFile["id"][];
  /** Whether this is a direct transfer/settlement */
  isTransfer?: boolean;
  /** Hash for conflict detection */
  __hash: string;
  /** Temporary edit state for optimistic updates */
  __editCopy?: Omit<Expense, "__editCopy">;
  /** When the edit copy was last updated */
  __editCopyLastUpdatedAt?: Date;
}

/**
 * How an expense is shared - either an exact amount or a proportional division.
 */
export type ExpenseShare = ExpenseShareExact | ExpenseShareDivide;

/**
 * An exact amount that a participant owes.
 */
export interface ExpenseShareExact {
  type: "exact";
  /** Amount in cents */
  value: number;
}

/**
 * A proportional share (e.g., 1 share out of N total shares).
 */
export interface ExpenseShareDivide {
  type: "divide";
  /** Number of shares (not money, just proportion) */
  value: number;
  /** Calculated exact amount after division */
  calculatedExact?: number;
}

/**
 * Balance statistics for a participant.
 */
export interface Balance {
  participantId: string;
  stats: {
    /** Total amount this participant owes to others */
    userOwes: number;
    /** Total amount owed to this participant */
    owedToUser: number;
    /** Per-participant debt breakdown */
    diffs: Record<string, { diffUnsplitted: number }>;
    /** Net balance (positive = owed money, negative = owes money) */
    balance: number;
  };
  /** Visual ratio for UI display (0-1 range) */
  visualRatio: number;
}

/**
 * Balances indexed by participant ID.
 */
export type BalancesByParticipant = Record<string, Balance>;

/**
 * A simplified transaction for settling debts.
 */
export interface SimplifiedTransaction {
  fromId: string;
  toId: string;
  /** Amount (negative because it represents debt) */
  amount: number;
}

/**
 * Get the total amount of an expense in cents.
 */
export function getExpenseTotalAmount(
  expense: Pick<Expense, "paidBy">,
): number {
  return Object.values(expense.paidBy).reduce((acc, curr) => acc + curr, 0);
}

/**
 * Create a unique expense ID.
 *
 * @param chunkId - The chunk this expense belongs to
 * @param ulid - The ULID function to use for generating IDs
 * @param timestamp - Optional timestamp for the ULID
 */
export function createExpenseId(
  chunkId: string,
  ulid: (timestamp?: number) => string,
  timestamp?: number,
): string {
  return `${ulid(timestamp)}:${chunkId}`;
}

/**
 * Decode an expense ID into its components.
 */
export function decodeExpenseId(expenseId: string): {
  chunkId: DocumentId;
  expenseId: string;
} {
  const [id, chunkId] = expenseId.split(":");
  return { chunkId: chunkId as DocumentId, expenseId: id };
}

/**
 * Find an expense by its ID using binary search.
 * Assumes expenses are sorted in descending order by ID.
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

/**
 * Simplify balances into a minimal set of transactions.
 * Uses a greedy algorithm matching largest debts with largest credits.
 */
export function simplifyBalanceTransactions(
  balances: BalancesByParticipant,
): SimplifiedTransaction[] {
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [participantId, balance] of Object.entries(balances)) {
    const balanceAmount = balance.stats.balance;

    if (balanceAmount < 0) {
      debtors.push({ id: participantId, amount: Math.abs(balanceAmount) });
    } else if (balanceAmount > 0) {
      creditors.push({ id: participantId, amount: balanceAmount });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SimplifiedTransaction[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0) {
      transactions.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: -transferAmount,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount === 0) {
      debtorIndex++;
    }
    if (creditor.amount === 0) {
      creditorIndex++;
    }
  }

  return transactions;
}

/**
 * Merge multiple balance objects into one.
 */
export function mergeBalancesByParticipant(
  ...balancesByParticipant: BalancesByParticipant[]
): BalancesByParticipant {
  const merged: BalancesByParticipant = {};

  for (const balances of balancesByParticipant) {
    for (const [participantId, balance] of Object.entries(balances)) {
      const existing = merged[participantId];

      if (!existing) {
        merged[participantId] = { ...balance };
      } else {
        existing.stats.balance += balance.stats.balance;
        existing.stats.userOwes += balance.stats.userOwes;
        existing.stats.owedToUser += balance.stats.owedToUser;

        for (const [pid, diff] of Object.entries(balance.stats.diffs)) {
          const existingDiff = existing.stats.diffs[pid];

          if (!existingDiff) {
            existing.stats.diffs[pid] = { ...diff };
          } else {
            existingDiff.diffUnsplitted += diff.diffUnsplitted;
          }
        }
      }
    }
  }

  // Recalculate visual ratios
  const balancesArray = Object.values(merged);
  if (balancesArray.length > 0) {
    const biggestAbsoluteBalance = balancesArray.reduce((prev, next) => {
      const prevAbs = Math.abs(prev.stats.balance);
      const nextAbs = Math.abs(next.stats.balance);
      return prevAbs > nextAbs ? prev : next;
    });

    const referenceBalance = biggestAbsoluteBalance.stats.balance;

    for (const balance of balancesArray) {
      balance.visualRatio =
        referenceBalance !== 0 ? balance.stats.balance / referenceBalance : 0;
    }
  }

  return merged;
}
