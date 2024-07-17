import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { Currency } from "./currency";

export interface Party {
  id: DocumentId;
  name: string;
  description: string;
  currency: Currency;
  participants: Record<ExpenseUser, PartyParticipant>;
  expenses: PartyExpense[];
}

export interface PartyExpense {
  paidAt: Date;
  documentId: DocumentId; // Expense
}

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  isArchived?: boolean;
}
