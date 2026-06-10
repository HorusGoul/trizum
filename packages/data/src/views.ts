import { mutation, view } from "@nkzw/fate";
import type {
  CreateExpenseChunkBalancesInput,
  CreateExpenseChunkInput,
  CreateExpenseInput,
  CreateMediaFileInput,
  CreatePartyMemberInput,
  CreateParticipantInput,
  CreatePartyInput,
  CreateUserInput,
  CreateUserPartyStateInput,
  ExpenseChunkBalancesRow,
  ExpenseChunkRow,
  ExpenseRow,
  MediaFileRow,
  PartyMemberRow,
  ParticipantRow,
  PartyRow,
  UserPartyStateRow,
  UserRow,
} from "./schema.js";

export type UserEntity = WithTypename<
  "User",
  Omit<UserRow, "fullAccountUserId"> & {
    fullAccountUserId?: UserRow["fullAccountUserId"];
  }
>;

export type PartyEntity = WithTypename<
  "Party",
  Omit<PartyRow, "localOnlyInviteSecret"> & {
    localOnlyInviteSecret?: PartyRow["localOnlyInviteSecret"];
  }
>;

export type PartyMemberEntity = WithTypename<"PartyMember", PartyMemberRow>;
export type UserPartyStateEntity = WithTypename<"UserPartyState", UserPartyStateRow>;
export type ParticipantEntity = WithTypename<"Participant", ParticipantRow>;
export type MediaFileEntity = WithTypename<"MediaFile", MediaFileRow>;
export type ExpenseChunkEntity = WithTypename<"ExpenseChunk", ExpenseChunkRow>;
export type ExpenseChunkBalancesEntity = WithTypename<
  "ExpenseChunkBalances",
  ExpenseChunkBalancesRow
>;

export type ExpenseEntity = WithTypename<
  "Expense",
  Omit<ExpenseRow, "editCopy" | "internalMemo"> & {
    editCopy?: ExpenseRow["editCopy"];
    internalMemo?: ExpenseRow["internalMemo"];
  }
>;

export type TrizumFateEntity =
  | ExpenseChunkBalancesEntity
  | ExpenseChunkEntity
  | ExpenseEntity
  | MediaFileEntity
  | ParticipantEntity
  | PartyEntity
  | PartyMemberEntity
  | UserEntity
  | UserPartyStateEntity;
export type TrizumFateTypename = TrizumFateEntity["__typename"];

type WithTypename<Typename extends string, Row extends { id: string }> = Row & {
  __typename: Typename;
};

export const UserProfileView = view<UserEntity>()({
  id: true,
  displayName: true,
  phone: true,
  avatarId: true,
});

export const UserSettingsView = view<UserEntity>()({
  id: true,
  displayName: true,
  phone: true,
  avatarId: true,
  locale: true,
  hue: true,
  openLastPartyOnLaunch: true,
  autoOpenCalculator: true,
  lastOpenedPartyId: true,
  authMode: true,
  accountProvider: true,
});

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

export const PartyMemberView = view<PartyMemberEntity>()({
  id: true,
  partyId: true,
  userId: true,
  participantId: true,
  role: true,
});

export const UserPartyStateView = view<UserPartyStateEntity>()({
  id: true,
  userId: true,
  partyId: true,
  participantId: true,
  isPinned: true,
  isArchived: true,
  lastUsedAt: true,
});

export const ParticipantView = view<ParticipantEntity>()({
  id: true,
  partyId: true,
  name: true,
  avatarId: true,
  isArchived: true,
  personalMode: true,
  balancesSortedBy: true,
});

export const MediaFileMetadataView = view<MediaFileEntity>()({
  id: true,
  ownerUserId: true,
  partyId: true,
  metadata: true,
});

export const MediaFileBlobView = view<MediaFileEntity>()({
  id: true,
  metadata: true,
  encodedBlob: true,
});

export const ExpenseChunkView = view<ExpenseChunkEntity>()({
  id: true,
  partyId: true,
  createdAt: true,
  maxSize: true,
});

export const ExpenseChunkBalancesView = view<ExpenseChunkBalancesEntity>()({
  id: true,
  partyId: true,
  chunkId: true,
  balances: true,
});

export const ExpenseListItemView = view<ExpenseEntity>()({
  id: true,
  partyId: true,
  chunkId: true,
  name: true,
  paidAt: true,
  amount: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
});

export type CreateUserMutationInput = CreateUserInput;
export type CreatePartyMutationInput = CreatePartyInput;
export type CreatePartyMemberMutationInput = CreatePartyMemberInput;
export type CreateUserPartyStateMutationInput = CreateUserPartyStateInput;
export type CreateParticipantMutationInput = CreateParticipantInput;
export type CreateMediaFileMutationInput = CreateMediaFileInput;
export type CreateExpenseChunkMutationInput = CreateExpenseChunkInput;
export type CreateExpenseChunkBalancesMutationInput = CreateExpenseChunkBalancesInput;
export type CreateExpenseMutationInput = CreateExpenseInput;

export const trizumFateMutations = {
  "user.create": mutation<UserEntity, CreateUserMutationInput, UserEntity>("User"),
  "party.create": mutation<PartyEntity, CreatePartyMutationInput, PartyEntity>("Party"),
  "partyMember.create": mutation<
    PartyMemberEntity,
    CreatePartyMemberMutationInput,
    PartyMemberEntity
  >("PartyMember"),
  "userPartyState.create": mutation<
    UserPartyStateEntity,
    CreateUserPartyStateMutationInput,
    UserPartyStateEntity
  >("UserPartyState"),
  "participant.create": mutation<
    ParticipantEntity,
    CreateParticipantMutationInput,
    ParticipantEntity
  >("Participant"),
  "mediaFile.create": mutation<MediaFileEntity, CreateMediaFileMutationInput, MediaFileEntity>(
    "MediaFile",
  ),
  "expenseChunk.create": mutation<
    ExpenseChunkEntity,
    CreateExpenseChunkMutationInput,
    ExpenseChunkEntity
  >("ExpenseChunk"),
  "expenseChunkBalances.create": mutation<
    ExpenseChunkBalancesEntity,
    CreateExpenseChunkBalancesMutationInput,
    ExpenseChunkBalancesEntity
  >("ExpenseChunkBalances"),
  "expense.create": mutation<ExpenseEntity, CreateExpenseMutationInput, ExpenseEntity>("Expense"),
};
