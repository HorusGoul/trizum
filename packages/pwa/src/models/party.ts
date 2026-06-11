import type { ExpenseUser } from "#src/lib/expenses.js";
import type { Currency } from "dinero.js";
import type { MediaFile } from "./media";

export interface Party {
  id: string;
  type: "party";
  name: string;
  symbol?: string;
  description: string;
  currency: Currency;
  participants: Record<ExpenseUser, PartyParticipant>;
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
