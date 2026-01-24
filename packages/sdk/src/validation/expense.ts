/**
 * Expense validators.
 */

import type { ValidationResult } from "./common.js";
import {
  EXPENSE_TITLE_REQUIRED,
  EXPENSE_TITLE_TOO_LONG,
  EXPENSE_AMOUNT_REQUIRED,
  EXPENSE_AMOUNT_INVALID,
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
