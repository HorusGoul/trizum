import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { Currency } from "./currency";
import type { Expense } from "./expense";

export interface Party {
  id: DocumentId;
  name: string;
  description: string;
  currency: Currency;
  participants: Record<ExpenseUser, PartyParticipant>;
  chunkIds: PartyExpenseChunk["id"][];
}

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  isArchived?: boolean;
}

export interface PartyExpenseChunk {
  id: DocumentId;
  createdAt: Date;
  expenses: Expense[];
  maxSize: number;
}
