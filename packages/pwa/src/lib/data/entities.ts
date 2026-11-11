import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import type { PartyList } from "#src/models/partyList.ts";
import type { Expense } from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";

export type PartyEntity = Party & { __typename: "Party"; available: boolean };

export type ProfileEntity = PartyList & { __typename: "Profile"; available: boolean };

export type ExpenseEntity = Expense & { __typename: "Expense"; available: boolean };

export type ExpenseChunkEntity = Omit<PartyExpenseChunk, "expenses"> & {
  __typename: "ExpenseChunk";
  available: boolean;
  expenses: ExpenseEntity[];
};

export type BalanceEntity = PartyExpenseChunkBalances & {
  __typename: "Balance";
  available: boolean;
};

export type MediaEntity = MediaFile & { __typename: "Media"; available: boolean };
