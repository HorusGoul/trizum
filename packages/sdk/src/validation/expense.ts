/**
 * Expense validators.
 */

import type { ExpenseShare, ExpenseUser } from "../models/expense.js";
import type { ValidationResult } from "./common.js";
import {
  EXPENSE_TITLE_REQUIRED,
  EXPENSE_TITLE_TOO_LONG,
  EXPENSE_AMOUNT_REQUIRED,
  EXPENSE_AMOUNT_INVALID,
  EXPENSE_PAID_BY_NOT_INTEGER,
  EXPENSE_SHARE_VALUE_NOT_INTEGER,
} from "./error-keys.js";
import { MAX_PARTY_TITLE_LENGTH } from "./party.js";

/**
 * Validate an expense title.
 * Uses the same rules as party title validation.
 *
 * @param title - The title to validate
 * @returns Error key if invalid, null if valid
 */
export function validateExpenseTitle(title: string): ValidationResult {
  const trimmed = title.trim();

  if (!trimmed) {
    return EXPENSE_TITLE_REQUIRED;
  }

  if (trimmed.length > MAX_PARTY_TITLE_LENGTH) {
    return EXPENSE_TITLE_TOO_LONG;
  }

  return null;
}

/**
 * Validate an expense amount (in display format, e.g., 10.50).
 *
 * @param amount - The amount to validate
 * @returns Error key if invalid, null if valid
 */
export function validateExpenseAmount(
  amount: number | string,
): ValidationResult {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || numAmount === 0) {
    return EXPENSE_AMOUNT_REQUIRED;
  }

  if (numAmount < 0) {
    return EXPENSE_AMOUNT_INVALID;
  }

  return null;
}

/**
 * Validate that paidBy amounts are integers (cents).
 * Dinero.js requires integer amounts.
 *
 * @param paidBy - Record of participant IDs to amounts (in cents)
 * @returns Error key if invalid, null if valid
 */
export function validateExpensePaidBy(
  paidBy: Record<ExpenseUser, number>,
): ValidationResult {
  for (const amount of Object.values(paidBy)) {
    if (!Number.isInteger(amount)) {
      return EXPENSE_PAID_BY_NOT_INTEGER;
    }
  }
  return null;
}

/**
 * Validate that share values are integers.
 * For "exact" shares, the value is in cents and must be an integer.
 * For "divide" shares, the value is a share count and should also be an integer.
 *
 * @param shares - Record of participant IDs to share specifications
 * @returns Error key if invalid, null if valid
 */
export function validateExpenseShares(
  shares: Record<ExpenseUser, ExpenseShare>,
): ValidationResult {
  for (const share of Object.values(shares)) {
    if (!Number.isInteger(share.value)) {
      return EXPENSE_SHARE_VALUE_NOT_INTEGER;
    }
  }
  return null;
}
