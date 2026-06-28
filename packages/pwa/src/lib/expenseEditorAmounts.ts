import { convertToUnits } from "#src/lib/expenses.js";

export const expenseEditorAmountMinValue = 0;

export function normalizeExpenseEditorAmount(value: number) {
  if (!Number.isFinite(value)) {
    return expenseEditorAmountMinValue;
  }

  return Math.max(value, expenseEditorAmountMinValue);
}

export function convertExpenseEditorAmountToUnits(value: number) {
  return convertToUnits(normalizeExpenseEditorAmount(value));
}
