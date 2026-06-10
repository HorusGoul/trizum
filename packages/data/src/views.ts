import { mutation, view } from "@nkzw/fate";
import type {
  CreateExpenseInput,
  CreateParticipantInput,
  CreatePartyInput,
  ExpenseRow,
  ParticipantRow,
  PartyRow,
} from "./schema.js";

export type PartyEntity = WithTypename<
  "Party",
  Omit<PartyRow, "localOnlyInviteSecret"> & {
    localOnlyInviteSecret?: PartyRow["localOnlyInviteSecret"];
  }
>;

export type ParticipantEntity = WithTypename<"Participant", ParticipantRow>;

export type ExpenseEntity = WithTypename<
  "Expense",
  Omit<ExpenseRow, "internalMemo"> & {
    internalMemo?: ExpenseRow["internalMemo"];
  }
>;

export type TrizumFateEntity = PartyEntity | ParticipantEntity | ExpenseEntity;
export type TrizumFateTypename = TrizumFateEntity["__typename"];

type WithTypename<Typename extends string, Row extends { id: string }> = Row & {
  __typename: Typename;
};

export const PartySummaryView = view<PartyEntity>()({
  id: true,
  name: true,
  symbol: true,
  currency: true,
});

export const PartySettingsView = view<PartyEntity>()({
  id: true,
  name: true,
  symbol: true,
  description: true,
  currency: true,
  ownerUserId: true,
});

export const ParticipantView = view<ParticipantEntity>()({
  id: true,
  partyId: true,
  name: true,
  avatarId: true,
  isArchived: true,
  personalMode: true,
});

export const ExpenseListItemView = view<ExpenseEntity>()({
  id: true,
  partyId: true,
  name: true,
  paidAt: true,
  amount: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
});

export type CreatePartyMutationInput = CreatePartyInput;
export type CreateParticipantMutationInput = CreateParticipantInput;
export type CreateExpenseMutationInput = CreateExpenseInput;

export const trizumFateMutations = {
  "party.create": mutation<PartyEntity, CreatePartyMutationInput, PartyEntity>("Party"),
  "participant.create": mutation<
    ParticipantEntity,
    CreateParticipantMutationInput,
    ParticipantEntity
  >("Participant"),
  "expense.create": mutation<ExpenseEntity, CreateExpenseMutationInput, ExpenseEntity>("Expense"),
};
