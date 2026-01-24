/**
 * Party model and related types.
 *
 * A Party represents a group of people sharing expenses together.
 */

import type { CurrencyCode, DocumentId } from "../types.js";
import type { BalancesByParticipant, Expense, ExpenseUser } from "./expense.js";
import type { MediaFile } from "./media.js";

/**
 * A party (expense group) document.
 */
export interface Party {
  /** Document ID (self-referential) */
  id: DocumentId;
  /** Document type discriminator */
  type: "party";
  /** Schema version for migrations (optional, defaults to 0 if missing) */
  __schemaVersion?: number;
  /** Party name */
  name: string;
  /** Optional description */
  description: string;
  /** Currency for all expenses */
  currency: CurrencyCode;
  /** Theme color hue (0-360) */
  hue?: number;
  /** All participants in this party */
  participants: Record<ExpenseUser, PartyParticipant>;
  /** References to expense chunks */
  chunkRefs: PartyExpenseChunkRef[];
}

/**
 * Sorting options for balance display.
 */
export type BalancesSortedBy =
  | "name"
  | "balance-ascending"
  | "balance-descending";

/**
 * A participant in a party.
 */
export interface PartyParticipant {
  /** Unique ID within the party */
  id: ExpenseUser;
  /** Display name */
  name: string;
  /** Phone number for contact */
  phone?: string;
  /** Profile picture */
  avatarId?: MediaFile["id"] | null;
  /** Soft-delete flag */
  isArchived?: boolean;
  /** Only pays for themselves */
  personalMode?: boolean;
  /** UI preference for balance sorting */
  balancesSortedBy?: BalancesSortedBy;
}

/**
 * Reference to an expense chunk within a party.
 */
export interface PartyExpenseChunkRef {
  /** The chunk document ID */
  chunkId: DocumentId;
  /** When the chunk was created */
  createdAt: Date;
  /** Associated balances document ID */
  balancesId: DocumentId;
}

/**
 * An expense chunk containing up to 500 expenses.
 * Chunks are used to prevent documents from growing too large.
 */
export interface PartyExpenseChunk {
  /** Document ID (self-referential) */
  id: DocumentId;
  /** Document type discriminator */
  type: "expenseChunk";
  /** Schema version for migrations (optional, defaults to 0 if missing) */
  __schemaVersion?: number;
  /** When this chunk was created */
  createdAt: Date;
  /** Expenses in this chunk (newest first) */
  expenses: Expense[];
  /** Maximum number of expenses per chunk */
  maxSize: number;
  /** Parent party ID */
  partyId: Party["id"];
}

/**
 * Pre-calculated balances for an expense chunk.
 */
export interface PartyExpenseChunkBalances {
  /** Document ID (self-referential) */
  id: DocumentId;
  /** Document type discriminator */
  type: "expenseChunkBalances";
  /** Schema version for migrations (optional, defaults to 0 if missing) */
  __schemaVersion?: number;
  /** Balances for this chunk */
  balances: BalancesByParticipant;
  /** Parent party ID */
  partyId: Party["id"];
}

/**
 * Input for creating a new party.
 */
export interface CreatePartyInput {
  name: string;
  description?: string;
  currency: CurrencyCode;
  hue?: number;
  participants?: Record<ExpenseUser, Omit<PartyParticipant, "id">>;
}

/**
 * Get active (non-archived) participants from a party.
 */
export function getActiveParticipants(
  party: Party,
): Record<ExpenseUser, PartyParticipant> {
  return Object.fromEntries(
    Object.entries(party.participants).filter(
      ([, participant]) => !participant.isArchived,
    ),
  );
}

/**
 * Get archived participants from a party.
 */
export function getArchivedParticipants(
  party: Party,
): Record<ExpenseUser, PartyParticipant> {
  return Object.fromEntries(
    Object.entries(party.participants).filter(
      ([, participant]) => participant.isArchived,
    ),
  );
}
