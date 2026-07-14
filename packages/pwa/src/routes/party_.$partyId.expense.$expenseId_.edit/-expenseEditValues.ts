import { getExpenseTotalAmount, type Expense } from "#src/models/expense.ts";
import { clone } from "@opentf/std";

const TIME_TO_DISCARD_EDIT_COPY = 1000 * 60 * 5;

export function getExpenseEditValues(expense: Expense, now = Date.now()) {
  const currentExpense = shouldUseEditCopy(expense, now) ? expense.__editCopy : expense;

  return {
    name: currentExpense.name,
    amount: getExpenseTotalAmount(currentExpense) / 100,
    paidAt: currentExpense.paidAt,
    paidBy: Object.keys(currentExpense.paidBy)[0],
    shares: currentExpense.shares,
    photos: currentExpense.photos,
  };
}

export function getExpenseEditHash(expense: Expense, now = Date.now()) {
  return shouldUseEditCopy(expense, now) ? expense.__editCopy.__hash : expense.__hash;
}

export function getOrCreateExpenseEditCopy(expense: Expense, now = Date.now()) {
  if (shouldUseEditCopy(expense, now)) {
    return expense.__editCopy;
  }

  const editCopy = clone(expense);
  delete editCopy.__editCopy;
  delete editCopy.__editCopyLastUpdatedAt;
  expense.__editCopy = editCopy;

  return expense.__editCopy;
}

function shouldUseEditCopy(
  expense: Expense,
  now: number,
): expense is Expense & { __editCopy: Omit<Expense, "__editCopy"> } {
  if (!expense.__editCopy || !expense.__editCopyLastUpdatedAt) {
    return false;
  }

  return expense.__editCopyLastUpdatedAt.getTime() + TIME_TO_DISCARD_EDIT_COPY > now;
}
