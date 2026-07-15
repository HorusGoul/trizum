import type { ExpenseUser } from "#src/lib/expenses.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { createMoney } from "#src/lib/money.ts";
import { getExpenseUnitShares } from "#src/models/expense.ts";
import { add, equal } from "dinero.js";

export type ExpenseEditorShares = Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;

export function getExpenseEditorUnitShares(amount: number, shares: ExpenseEditorShares) {
  const unitShares = getExpenseUnitShares({
    shares,
    paidBy: { noop: convertToUnits(amount) },
  });

  return Object.fromEntries(
    Object.entries(unitShares).map(([participantId, participantAmount]) => [
      participantId,
      Math.max(participantAmount, 0),
    ]),
  );
}

export function expenseEditorSharesMatchAmount(amount: number, shares: ExpenseEditorShares) {
  const totalAmount = createMoney(convertToUnits(amount));
  const totalSplit = Object.values(getExpenseEditorUnitShares(amount, shares)).reduce(
    (total, participantAmount) => add(total, createMoney(participantAmount)),
    createMoney(0),
  );

  return equal(totalSplit, totalAmount);
}
