import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { BalancesByParticipant, Expense } from "./expense";
import type { Currency } from "dinero.js";
import type { MediaFile } from "./media";

export interface Party {
  id: DocumentId;
  type: "party";
  name: string;
  symbol?: string;
  description: string;
  currency: Currency;
  participants: Record<ExpenseUser, PartyParticipant>;
  chunkRefs: PartyExpenseChunkRef[];
}

export const DEFAULT_PARTY_SYMBOL = "🏝️";

export type BalancesSortedBy =
  | "name"
  | "balance-ascending"
  | "balance-descending";

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  avatarId?: MediaFile["id"] | null;
  isArchived?: boolean;
  personalMode?: boolean;
  balancesSortedBy?: BalancesSortedBy;
}

export interface PartyExpenseChunkRef {
  chunkId: PartyExpenseChunk["id"];
  createdAt: Date;
  balancesId: PartyExpenseChunkBalances["id"];
}

export interface PartyExpenseChunk {
  id: DocumentId;
  type: "expenseChunk";
  createdAt: Date;
  expenses: Expense[];
  maxSize: number;
  partyId: Party["id"];
}

export interface PartyExpenseChunkBalances {
  id: DocumentId;
  type: "expenseChunkBalances";
  balances: BalancesByParticipant;
  partyId: Party["id"];
}
