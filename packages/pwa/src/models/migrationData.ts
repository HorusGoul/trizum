import type { Currency } from "dinero.js";

export interface MigrationData {
  party: {
    currency: Currency;
    description: string;
    name: string;
    participants: Record<string, MigrationParticipant>;
    symbol?: string;
    type: "party";
  };
  expenses: MigrationExpense[];
  photos: { id: string; url: string }[];
}

export interface MigrationParticipant {
  avatarId?: string | null;
  balancesSortedBy?: "name" | "balance-ascending" | "balance-descending";
  id: string;
  isArchived?: boolean;
  name: string;
  personalMode?: boolean;
  phone?: string;
}

export interface MigrationExpense {
  __editCopy?: undefined;
  __editCopyLastUpdatedAt?: undefined;
  isTransfer?: boolean;
  name: string;
  paidAt: string;
  paidBy: Record<string, number>;
  photos: string[];
  shares: Record<string, MigrationExpenseShare>;
}

export type MigrationExpenseShare =
  | {
      type: "divide";
      value: number;
      calculatedExact?: number;
    }
  | {
      type: "exact";
      value: number;
    };
