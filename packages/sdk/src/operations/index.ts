/**
 * SDK Operations - Business logic layer.
 *
 * This module contains all the business logic for manipulating models.
 * These operations handle document management internally.
 */

// Party operations
export {
  createParty,
  updateParty,
  updateParticipant,
  addParticipant,
  createExpense,
  updateExpense,
  deleteExpense,
  recalculateAllBalances,
  type CreatePartyInput,
  type CreatePartyResult,
  type UpdatePartyInput,
  type UpdateParticipantInput,
  type CreateExpenseInput,
} from "./party/index.js";

// PartyList operations
export {
  addPartyToList,
  removePartyFromList,
  setLastOpenedParty,
  updatePartyListSettings,
  getOrCreatePartyList,
} from "./party-list/index.js";

// Utilities
export { calculateExpenseHash } from "./utils/expense-hash.js";
export { getExpenseDiff, applyExpenseDiff } from "./utils/expense-diff.js";
