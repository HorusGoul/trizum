import type { ExpenseInput, ExpenseUser } from "#src/lib/expenses.js";

export interface Expense {
  name: string;
  description: string;
  paidAt: Date;
  paidBy: Record<ExpenseUser, number>;
  shares: Record<ExpenseUser, ExpenseShare>;
}

export type ExpenseShare = ExpenseShareExact | ExpenseShareDivide;

export interface ExpenseShareExact {
  type: "exact";
  value: number;
}

export interface ExpenseShareDivide {
  type: "divide";
  value: number;
  calculatedExact?: number;
}

export function exportIntoInput(expense: Expense): ExpenseInput[] {
  if (Object.keys(expense.paidBy).length === 0) {
    console.warn("Noone paid for this Expense");
    return [];
  }
  const total = Object.values(expense.paidBy).reduce(
    (acc, curr) => acc + curr,
    0,
  );
  return Object.keys(expense.paidBy).map((user): ExpenseInput => {
    const partial = expense.paidBy[user];
    const factor = partial / total;
    const paidFor: Record<ExpenseUser, number> = {};
    let amountLeft = partial;
    const exacts: Record<ExpenseUser, ExpenseShareExact> = Object.keys(
      expense.shares,
    )
      .filter((share) => expense.shares[share].type === "exact")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});
    const divides: Record<ExpenseUser, ExpenseShareDivide> = Object.keys(
      expense.shares,
    )
      .filter((share) => expense.shares[share].type === "divide")
      .reduce((acc, curr) => ({ ...acc, [curr]: expense.shares[curr] }), {});
    for (const exact of Object.keys(exacts)) {
      const amount = exacts[exact].value * factor;
      paidFor[exact] = amount;
      amountLeft -= amount;
    }
    if (amountLeft < 0) {
      console.error("Negative amounts left");
    }
    const totalDivides = Object.values(divides).reduce(
      (acc, curr) => acc + curr.value,
      0,
    );
    for (const divide of Object.keys(divides)) {
      const dFactor = divides[divide].value / totalDivides;
      const amount = amountLeft * dFactor;
      paidFor[divide] = amount;
    }
    return {
      version: 1,
      paidBy: user,
      expense: partial,
      paidFor,
    };
  });
}
