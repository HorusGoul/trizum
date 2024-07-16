import type { ExpenseUser } from "#src/lib/expenses.js";

export interface Expense {
  id: string;
  name: string;
  description: string;
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
}
