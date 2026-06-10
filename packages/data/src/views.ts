import { mutation, view } from "@nkzw/fate";
import type {
  CreateExpenseInput,
  CreateJoinedPartyInput,
  CreateMediaFileInput,
  CreatePartyMemberInput,
  CreateParticipantInput,
  CreatePartyInput,
  CreateUserInput,
  ExpenseRow,
  JoinedPartyRow,
  MediaFileRow,
  PartyMemberRow,
  ParticipantRow,
  PartyRow,
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
export type JoinedPartyEntity = WithTypename<"JoinedParty", JoinedPartyRow>;
export type ParticipantEntity = WithTypename<"Participant", ParticipantRow>;
export type MediaFileEntity = WithTypename<"MediaFile", MediaFileRow>;

export type ExpenseEntity = WithTypename<
  "Expense",
  Omit<ExpenseRow, "editCopy" | "internalMemo"> & {
    editCopy?: ExpenseRow["editCopy"];
    internalMemo?: ExpenseRow["internalMemo"];
  }
>;

export type TrizumFateEntity =
  | ExpenseEntity
  | JoinedPartyEntity
  | MediaFileEntity
  | ParticipantEntity
  | PartyEntity
  | PartyMemberEntity
  | UserEntity;
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

export const JoinedPartyView = view<JoinedPartyEntity>()({
  id: true,
  userId: true,
  partyId: true,
  participantId: true,
  isPinned: true,
  isArchived: true,
  joinedAt: true,
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

export type CreateUserMutationInput = CreateUserInput;
export type CreatePartyMutationInput = CreatePartyInput;
export type CreatePartyMemberMutationInput = CreatePartyMemberInput;
export type CreateJoinedPartyMutationInput = CreateJoinedPartyInput;
export type CreateParticipantMutationInput = CreateParticipantInput;
export type CreateMediaFileMutationInput = CreateMediaFileInput;
export type CreateExpenseMutationInput = CreateExpenseInput;
export type UpsertUserMutationInput = Partial<CreateUserInput> & {
  id: string;
};
export type UpsertPartyMutationInput = CreatePartyInput & {
  id: string;
};
export type UpsertPartyMemberMutationInput = CreatePartyMemberInput & {
  id: string;
};
export type UpsertJoinedPartyMutationInput = CreateJoinedPartyInput & {
  id: string;
};
export type UpsertParticipantMutationInput = CreateParticipantInput & {
  id: string;
};

export const trizumFateMutations = {
  "user.create": mutation<UserEntity, CreateUserMutationInput, UserEntity>("User"),
  "user.upsert": mutation<UserEntity, UpsertUserMutationInput, UserEntity>("User"),
  "party.create": mutation<PartyEntity, CreatePartyMutationInput, PartyEntity>("Party"),
  "party.upsert": mutation<PartyEntity, UpsertPartyMutationInput, PartyEntity>("Party"),
  "partyMember.create": mutation<
    PartyMemberEntity,
    CreatePartyMemberMutationInput,
    PartyMemberEntity
  >("PartyMember"),
  "partyMember.upsert": mutation<
    PartyMemberEntity,
    UpsertPartyMemberMutationInput,
    PartyMemberEntity
  >("PartyMember"),
  "joinedParty.create": mutation<
    JoinedPartyEntity,
    CreateJoinedPartyMutationInput,
    JoinedPartyEntity
  >("JoinedParty"),
  "joinedParty.upsert": mutation<
    JoinedPartyEntity,
    UpsertJoinedPartyMutationInput,
    JoinedPartyEntity
  >("JoinedParty"),
  "participant.create": mutation<
    ParticipantEntity,
    CreateParticipantMutationInput,
    ParticipantEntity
  >("Participant"),
  "participant.upsert": mutation<
    ParticipantEntity,
    UpsertParticipantMutationInput,
    ParticipantEntity
  >("Participant"),
  "mediaFile.create": mutation<MediaFileEntity, CreateMediaFileMutationInput, MediaFileEntity>(
    "MediaFile",
  ),
  "expense.create": mutation<ExpenseEntity, CreateExpenseMutationInput, ExpenseEntity>("Expense"),
};
