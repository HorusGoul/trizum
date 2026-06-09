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
  activityLogId?: PartyActivityLog["id"];
  /** @deprecated Move entries to the separate PartyActivityLog document. */
  activityLog?: PartyActivityLogEntry[];
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
}

export type PartyActivityLogEntry =
  | {
      id: string;
      createdAt: Date;
      type: "party-created";
      partyName: string;
    }
  | {
      id: string;
      createdAt: Date;
      type: "party-settings-updated";
      changes: PartyActivitySettingsChange[];
    }
  | {
      id: string;
      createdAt: Date;
      type: "participant-added";
      participantId: PartyParticipant["id"];
      participantName: string;
    }
  | {
      id: string;
      createdAt: Date;
      type: "participant-updated";
      participantId: PartyParticipant["id"];
      participantName: string;
      changes: PartyActivityParticipantChange[];
    }
  | {
      id: string;
      createdAt: Date;
      type: "participant-archived" | "participant-restored";
      participantId: PartyParticipant["id"];
      participantName: string;
    }
  | {
      id: string;
      createdAt: Date;
      type: "participant-removed";
      participantId: PartyParticipant["id"];
      participantName: string;
    }
  | {
      id: string;
      createdAt: Date;
      type: "expense-added" | "expense-updated" | "expense-removed";
      expenseId: Expense["id"];
      expenseName: Expense["name"];
      amount: number;
    }
  | {
      id: string;
      createdAt: Date;
      type: "debt-transferred";
      originExpenseId: Expense["id"];
      originExpenseName: Expense["name"];
      destinationExpenseId: Expense["id"];
      destinationExpenseName: Expense["name"];
      amount: number;
    };

export type PartyActivitySettingsChange = "name" | "symbol" | "description";

export type PartyActivityParticipantChange = "name" | "phone" | "avatar";

export type PartyActivityLogEntryInput = PartyActivityLogEntry extends infer Entry
  ? Entry extends PartyActivityLogEntry
    ? Omit<Entry, "id" | "createdAt">
    : never
  : never;

export interface PartyActivityLog {
  id: DocumentId;
  type: "partyActivityLog";
  partyId: Party["id"];
  entries: PartyActivityLogEntry[];
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
