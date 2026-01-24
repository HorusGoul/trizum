/**
 * Validation module for SDK models.
 *
 * Validators return error keys (strings) that can be mapped to
 * translated messages by the consuming application.
 */

// Common utilities
export type { ValidationResult, Validator } from "./common.js";
export {
  composeValidators,
  required,
  maxLength,
  minLength,
  positive,
  nonNegative,
  createValidator,
} from "./common.js";

// Error keys
export {
  PARTY_TITLE_REQUIRED,
  PARTY_TITLE_TOO_LONG,
  PARTY_DESCRIPTION_TOO_LONG,
  PARTICIPANT_NAME_REQUIRED,
  PARTICIPANT_NAME_TOO_LONG,
  PHONE_NUMBER_TOO_LONG,
  EXPENSE_TITLE_REQUIRED,
  EXPENSE_TITLE_TOO_LONG,
  EXPENSE_AMOUNT_REQUIRED,
  EXPENSE_AMOUNT_INVALID,
  DOCUMENT_ID_REQUIRED,
  DOCUMENT_ID_INVALID,
  type ValidationErrorKey,
} from "./error-keys.js";

// Party validators
export {
  validatePartyTitle,
  validatePartyDescription,
  validateParticipantName,
  validatePhoneNumber,
  MAX_PARTY_TITLE_LENGTH,
  MAX_PARTY_DESCRIPTION_LENGTH,
  MAX_PARTICIPANT_NAME_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
} from "./party.js";

// Expense validators
export { validateExpenseTitle, validateExpenseAmount } from "./expense.js";

// Document validators
export { validateDocumentId } from "./document.js";
