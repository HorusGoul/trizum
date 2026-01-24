/**
 * Standard validation error keys.
 *
 * These keys are returned by validators and can be mapped to translated
 * error messages by the consuming application.
 */

// Party validation error keys
export const PARTY_TITLE_REQUIRED = "PARTY_TITLE_REQUIRED";
export const PARTY_TITLE_TOO_LONG = "PARTY_TITLE_TOO_LONG";
export const PARTY_DESCRIPTION_TOO_LONG = "PARTY_DESCRIPTION_TOO_LONG";

// Participant validation error keys
export const PARTICIPANT_NAME_REQUIRED = "PARTICIPANT_NAME_REQUIRED";
export const PARTICIPANT_NAME_TOO_LONG = "PARTICIPANT_NAME_TOO_LONG";
export const PHONE_NUMBER_TOO_LONG = "PHONE_NUMBER_TOO_LONG";

// Expense validation error keys
export const EXPENSE_TITLE_REQUIRED = "EXPENSE_TITLE_REQUIRED";
export const EXPENSE_TITLE_TOO_LONG = "EXPENSE_TITLE_TOO_LONG";
export const EXPENSE_AMOUNT_REQUIRED = "EXPENSE_AMOUNT_REQUIRED";
export const EXPENSE_AMOUNT_INVALID = "EXPENSE_AMOUNT_INVALID";
export const EXPENSE_PAID_BY_NOT_INTEGER = "EXPENSE_PAID_BY_NOT_INTEGER";
export const EXPENSE_SHARE_VALUE_NOT_INTEGER =
  "EXPENSE_SHARE_VALUE_NOT_INTEGER";

// Document ID validation error keys
export const DOCUMENT_ID_REQUIRED = "DOCUMENT_ID_REQUIRED";
export const DOCUMENT_ID_INVALID = "DOCUMENT_ID_INVALID";

/**
 * All validation error keys as a union type.
 */
export type ValidationErrorKey =
  | typeof PARTY_TITLE_REQUIRED
  | typeof PARTY_TITLE_TOO_LONG
  | typeof PARTY_DESCRIPTION_TOO_LONG
  | typeof PARTICIPANT_NAME_REQUIRED
  | typeof PARTICIPANT_NAME_TOO_LONG
  | typeof PHONE_NUMBER_TOO_LONG
  | typeof EXPENSE_TITLE_REQUIRED
  | typeof EXPENSE_TITLE_TOO_LONG
  | typeof EXPENSE_AMOUNT_REQUIRED
  | typeof EXPENSE_AMOUNT_INVALID
  | typeof EXPENSE_PAID_BY_NOT_INTEGER
  | typeof EXPENSE_SHARE_VALUE_NOT_INTEGER
  | typeof DOCUMENT_ID_REQUIRED
  | typeof DOCUMENT_ID_INVALID;
