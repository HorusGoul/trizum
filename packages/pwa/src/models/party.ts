import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { BalancesByParticipant, Expense } from "./expense";
import type { Currency } from "dinero.js";
import type { MediaFile } from "./media";

export interface Party {
  id: DocumentId;
  name: string;
  description: string;
  currency: Currency;
  participants: Record<ExpenseUser, PartyParticipant>;
  chunkRefs: PartyExpenseChunkRef[];
}

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  avatarId?: MediaFile["id"] | null;
  isArchived?: boolean;
  personalMode?: boolean;
}

export interface PartyExpenseChunkRef {
  chunkId: DocumentId;
  createdAt: Date;
  balancesByParticipant: BalancesByParticipant;
}

export interface PartyExpenseChunk {
  id: DocumentId;
  createdAt: Date;
  expenses: Expense[];
  maxSize: number;
}
