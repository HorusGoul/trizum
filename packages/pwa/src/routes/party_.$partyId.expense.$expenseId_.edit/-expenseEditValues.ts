import { getExpenseTotalAmount, type Expense } from "#src/models/expense.ts";

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

export function getExpenseEditHash(expense: Expense) {
  return shouldUseEditCopy(expense, Date.now()) ? expense.__editCopy.__hash : expense.__hash;
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
