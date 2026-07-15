import type { ExpenseUser } from "#src/lib/expenses.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { createMoney, getMoneyAmount } from "#src/lib/money.ts";
import { getExpenseUnitShares } from "#src/models/expense.ts";
import { add, equal } from "dinero.js";

export type ExpenseEditorShares = Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;

export interface ExpenseEditorValidationValues {
  amount: number;
  name: string;
  paidBy: ExpenseUser;
  shares: ExpenseEditorShares;
}

export interface ExpenseEditorValidationIssue {
  code: "shares-total-mismatch";
  severity: "error" | "warning";
  expenseAmount: number;
  sharesTotal: number;
}

export type ExpenseEditorValidationStatus =
  | "pristine"
  | "incomplete"
  | "valid"
  | "warning"
  | "error";

export interface ExpenseEditorValidationResult {
  issues: ExpenseEditorValidationIssue[];
  status: ExpenseEditorValidationStatus;
}

export type ExpenseEditorMode = "create" | "edit";

export interface ExpenseEditorValidationOptions {
  isDirty: boolean;
  mode: ExpenseEditorMode;
}

type ExpenseEditorValidationRule = (
  values: ExpenseEditorValidationValues,
) => ExpenseEditorValidationIssue | null;

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
  const totalSplit = createMoney(getExpenseEditorSharesTotal(amount, shares));

  return equal(totalSplit, totalAmount);
}

export function getExpenseEditorValidationIssues(values: ExpenseEditorValidationValues) {
  return expenseEditorValidationRules.flatMap((validate) => {
    const issue = validate(values);

    return issue ? [issue] : [];
  });
}

export function getExpenseEditorValidationResult(
  values: ExpenseEditorValidationValues,
  { isDirty, mode }: ExpenseEditorValidationOptions,
): ExpenseEditorValidationResult {
  const issues = getExpenseEditorValidationIssues(values);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const hasWarnings = issues.some((issue) => issue.severity === "warning");

  if (hasErrors) {
    return { issues, status: "error" };
  }

  if (hasWarnings) {
    return { issues, status: "warning" };
  }

  if (!isDirty && mode === "create") {
    return { issues, status: "pristine" };
  }

  if (!isExpenseEditorComplete(values)) {
    return { issues, status: "incomplete" };
  }

  return { issues, status: "valid" };
}

function getExpenseEditorSharesTotal(amount: number, shares: ExpenseEditorShares) {
  const totalSplit = Object.values(getExpenseEditorUnitShares(amount, shares)).reduce(
    (total, participantAmount) => add(total, createMoney(participantAmount)),
    createMoney(0),
  );

  return getMoneyAmount(totalSplit);
}

function isExpenseEditorComplete(values: ExpenseEditorValidationValues) {
  const title = values.name.trim();

  return (
    title.length > 0 &&
    title.length <= 50 &&
    values.amount > 0 &&
    Boolean(values.paidBy) &&
    Object.keys(values.shares).length > 0
  );
}

const validateSharesTotal: ExpenseEditorValidationRule = ({ amount, shares }) => {
  if (Object.keys(shares).length === 0 || expenseEditorSharesMatchAmount(amount, shares)) {
    return null;
  }

  return {
    code: "shares-total-mismatch",
    severity: "error",
    expenseAmount: convertToUnits(amount),
    sharesTotal: getExpenseEditorSharesTotal(amount, shares),
  };
};

const expenseEditorValidationRules = [validateSharesTotal] as const;
