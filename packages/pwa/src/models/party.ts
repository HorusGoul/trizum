import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { BalancesByParticipant, Expense } from "./expense";
import type { CurrencyCode } from "#src/lib/money.ts";
import type { MediaFile } from "./media";
import type { ExpenseTemplate } from "./expenseTemplate";

export interface Party {
  id: DocumentId;
  type: "party";
  name: string;
  symbol?: string;
  description: string;
  currency: CurrencyCode;
  participants: Record<ExpenseUser, PartyParticipant>;
  chunkRefs: PartyExpenseChunkRef[];
  expenseTemplates?: Record<ExpenseTemplate["id"], ExpenseTemplate>;
  defaultExpenseTemplateId?: ExpenseTemplate["id"];
}

export const DEFAULT_PARTY_SYMBOL = "🏝️";

export type BalancesSortedBy = "name" | "balance-ascending" | "balance-descending";

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  avatarId?: MediaFile["id"] | null;
  isArchived?: boolean;
  personalMode?: boolean;
  balancesSortedBy?: BalancesSortedBy;
  alwaysUseDefaultExpenseTemplate?: boolean;
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
