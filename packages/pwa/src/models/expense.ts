import { calculateLogStatsOfUser, type ExpenseInput, type ExpenseUser } from "#src/lib/expenses.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { ulid } from "ulidx";
import { add, subtract } from "dinero.js";
import type { MediaFile } from "./media";
import { diff } from "@opentf/obj-diff";
import { patchMutate } from "#src/lib/patchMutate.ts";
import { clone } from "@opentf/std";
import { md5 } from "@takker/md5";
import type { Party, PartyParticipant } from "./party";
import { assertNever } from "#src/lib/assertNever.ts";
import { getLogger } from "#src/lib/log.ts";
import { createMoney, getMoneyAmount } from "#src/lib/money.ts";

const logger = getLogger("models", "expense");

export interface Expense {
  id: string;
  name: string;
  paidAt: Date;
  paidBy: Record<ExpenseUser, number>;
  shares: Record<ExpenseUser, ExpenseShare>;
  photos: MediaFile["id"][];
  isTransfer?: boolean;
  __hash: string;
  __editCopy?: Omit<Expense, "__editCopy">;
  __editCopyLastUpdatedAt?: Date;
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
    logger.warning("No one paid for this expense");
    return [];
  }

  const total = getExpenseTotalAmount(expense);

  return Object.keys(expense.paidBy).map((user): ExpenseInput => {
    const partial = expense.paidBy[user];
    const paidFor: Record<ExpenseUser, number> = {};
    let amountLeft = createMoney(partial);

    const exacts: Record<ExpenseUser, ExpenseShareExact> = Object.keys(expense.shares)
      .filter((share) => expense.shares[share].type === "exact")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});

    const divides: Record<ExpenseUser, ExpenseShareDivide> = Object.keys(expense.shares)
      .filter((share) => expense.shares[share].type === "divide")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});

    for (const exact of Object.keys(exacts)) {
      const amount = createMoney(roundHalfEven((exacts[exact].value * partial) / total));
      paidFor[exact] = getMoneyAmount(amount);
      amountLeft = subtract(amountLeft, amount);
    }

    if (getMoneyAmount(amountLeft) < 0) {
      logger.error("Negative amounts left while exporting expense input", {
        expenseId: expense.id,
      });
    }

    const totalDivides = Object.values(divides).reduce((acc, curr) => acc + curr.value, 0);

    if (totalDivides > 0) {
      const totalLeftForDivides = getMoneyAmount(amountLeft);
      const divideUsers = Object.keys(divides);
      const divideAmounts = allocateMinorUnitsByNearest(
        totalLeftForDivides,
        divideUsers.map((divide) => divides[divide].value),
      );

      // Apply the calculated amounts
      for (const [index, divide] of divideUsers.entries()) {
        const divideAmount = divideAmounts[index];
        paidFor[divide] = divideAmount;
        amountLeft = subtract(amountLeft, createMoney(divideAmount));
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
  const expenseParticipantsIds = [...Object.keys(expense.paidBy), ...Object.keys(expense.shares)];

  const { userOwes, owedToUser } = calculateLogStatsOfUser(userId, expenseParticipantsIds, input);

  return getMoneyAmount(subtract(owedToUser, userOwes));
}

export function getExpenseUnitShares({ shares, paidBy }: Pick<Expense, "shares" | "paidBy">) {
  const amountInUnits = getExpenseTotalAmount({ paidBy });
  const activeParticipants = Object.keys(shares);

  const participantAmounts = (() => {
    const totalAmount = createMoney(amountInUnits);

    // First, calculate the total amount taken by exact shares using Dinero.js
    const exactTotal = activeParticipants.reduce((total, participantId) => {
      const share = shares[participantId];
      if (share?.type === "exact") {
        // Use Math.round to handle any floating point precision issues
        return add(total, createMoney(Math.round(share.value)));
      }
      return total;
    }, createMoney(0));

    // Remaining amount to be split among divide shares using Dinero.js
    const remainingAmount = subtract(totalAmount, exactTotal);
    const divideParticipants = activeParticipants.filter((participantId) => {
      const share = shares[participantId];
      return share?.type === "divide";
    });
    const divideAmounts = allocateMinorUnitsByNearest(
      getMoneyAmount(remainingAmount),
      divideParticipants.map((participantId) => {
        const share = shares[participantId];
        return share?.type === "divide" ? share.value : 0;
      }),
    );

    // First pass: calculate proportional amounts
    const proportionalAmounts = activeParticipants.reduce(
      (acc, participantId) => {
        const share = shares[participantId];
        let participantAmount = 0;

        if (share?.type === "divide") {
          participantAmount = divideAmounts[divideParticipants.indexOf(participantId)] ?? 0;
        } else if (share?.type === "exact") {
          // Exact shares are already in units
          participantAmount = share.value;
        }

        acc[participantId] = participantAmount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return proportionalAmounts;
  })();

  return participantAmounts;
}

function allocateMinorUnitsByNearest(amount: number, ratios: number[]) {
  const totalRatio = ratios.reduce((total, ratio) => total + ratio, 0);

  if (totalRatio <= 0) {
    return ratios.map(() => 0);
  }

  const amounts = ratios.map((ratio) => roundHalfEven(amount * (ratio / totalRatio)));
  const distributedTotal = amounts.reduce((total, next) => total + next, 0);
  const roundingError = amount - distributedTotal;

  if (roundingError === 0 || amounts.length === 0) {
    return amounts;
  }

  const sortedIndexes = amounts.map((_, index) => index);
  sortedIndexes.sort((a, b) => {
    if (roundingError > 0) {
      return amounts[a] - amounts[b];
    }

    return amounts[b] - amounts[a];
  });

  for (let i = 0; i < Math.abs(roundingError); i++) {
    const participantIndex = sortedIndexes[i % sortedIndexes.length];
    amounts[participantIndex] += roundingError > 0 ? 1 : -1;
  }

  return amounts;
}

function roundHalfEven(value: number) {
  const sign = value < 0 ? -1 : 1;
  const absoluteValue = Math.abs(value);
  const floor = Math.floor(absoluteValue);
  const fraction = absoluteValue - floor;

  if (Math.abs(fraction - 0.5) < 1e-10) {
    return sign * (floor % 2 === 0 ? floor : floor + 1);
  }

  return sign * Math.round(absoluteValue);
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
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

export interface Balance {
  participantId: PartyParticipant["id"];
  stats: {
    userOwes: number;
    owedToUser: number;
    diffs: Record<
      string,
      {
        diffUnsplitted: number;
      }
    >;
    balance: number;
  };
  visualRatio: number;
}

export type BalancesByParticipant = Record<PartyParticipant["id"], Balance>;

export interface SimplifiedTransaction {
  fromId: PartyParticipant["id"];
  toId: PartyParticipant["id"];
  amount: number;
}

/**
 * Simplifies balances into a minimal set of transactions using a greedy algorithm.
 * This matches people who owe the most with people who are owed the most.
 */
export function simplifyBalanceTransactions(
  balances: BalancesByParticipant,
): SimplifiedTransaction[] {
  // Create arrays of debtors (negative balance) and creditors (positive balance)
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [participantId, balance] of Object.entries(balances)) {
    const balanceAmount = balance.stats.balance;

    if (balanceAmount < 0) {
      // This person owes money (debtor)
      debtors.push({ id: participantId, amount: Math.abs(balanceAmount) });
    } else if (balanceAmount > 0) {
      // This person is owed money (creditor)
      creditors.push({ id: participantId, amount: balanceAmount });
    }
    // Skip if balance is 0
  }

  // Sort debtors and creditors by amount (largest first) for efficiency
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SimplifiedTransaction[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  // Greedy algorithm: match largest debts with largest credits
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    // Amount to transfer is the minimum of what debtor owes and what creditor is owed
    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0) {
      transactions.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: -transferAmount, // Negative because it represents debt
      });
    }

    // Update remaining amounts
    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    // Move to next debtor/creditor if current one is settled
    if (debtor.amount === 0) {
      debtorIndex++;
    }
    if (creditor.amount === 0) {
      creditorIndex++;
    }
  }

  return transactions;
}

export function calculateBalancesByParticipant(
  expenses: Expense[],
  partyParticipants: Party["participants"],
): BalancesByParticipant {
  const inputs = expenses.flatMap(exportIntoInput);
  const participantIds = Object.keys(partyParticipants);

  const balances = participantIds.map((participantId) => {
    const dineroStats = calculateLogStatsOfUser(participantId, participantIds, inputs);

    return {
      participantId,
      stats: {
        userOwes: getMoneyAmount(dineroStats.userOwes),
        owedToUser: getMoneyAmount(dineroStats.owedToUser),
        diffs: Object.fromEntries(
          Object.entries(dineroStats.diffs).map(([participantId, diff]) => [
            participantId,
            {
              diffUnsplitted: getMoneyAmount(diff.diffUnsplitted),
            },
          ]),
        ),
        balance: getMoneyAmount(dineroStats.balance),
      },
      visualRatio: 0,
    };
  });

  const withVisualRatios = calculateVisualRatioForBalances(balances);

  return Object.fromEntries(withVisualRatios.map((balance) => [balance.participantId, balance]));
}

export function mergeBalancesByParticipant(
  ...balancesByParticipant: BalancesByParticipant[]
): BalancesByParticipant {
  const merged: BalancesByParticipant = {};

  for (const balances of balancesByParticipant) {
    for (const [participantId, balance] of Object.entries(balances)) {
      const existing = merged[participantId];

      if (!existing) {
        merged[participantId] = balance;
      } else {
        existing.stats.balance += balance.stats.balance;
        existing.stats.userOwes += balance.stats.userOwes;
        existing.stats.owedToUser += balance.stats.owedToUser;

        // Merge diffs
        for (const [participantId, diff] of Object.entries(balance.stats.diffs)) {
          const existingDiff = existing.stats.diffs[participantId];

          if (!existingDiff) {
            existing.stats.diffs[participantId] = diff;
          } else {
            existingDiff.diffUnsplitted += diff.diffUnsplitted;
          }
        }
      }
    }
  }

  const balancesArray = Object.values(merged);
  const withVisualRatios =
    balancesArray.length > 0 ? calculateVisualRatioForBalances(balancesArray) : [];

  return Object.fromEntries(withVisualRatios.map((balance) => [balance.participantId, balance]));
}

function calculateVisualRatioForBalances(balances: Balance[]) {
  const biggestAbsoluteBalance = balances.reduce((prev, next) => {
    const prevAbs = Math.abs(prev.stats.balance);
    const nextAbs = Math.abs(next.stats.balance);

    return prevAbs > nextAbs ? prev : next;
  });

  // Biggest absolute balance should be considered as the reference point (1)
  const referenceBalance = biggestAbsoluteBalance.stats.balance;

  // Use the reference balance to calculate the visual ratio of each balance
  for (const balance of balances) {
    balance.visualRatio = balance.stats.balance / referenceBalance;
  }

  return balances;
}
