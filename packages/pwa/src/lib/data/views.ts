import { view } from "@nkzw/fate";
import type {
  PartyEntity,
  ProfileEntity,
  ExpenseEntity,
  ExpenseChunkEntity,
  BalanceEntity,
  MediaEntity,
} from "./entities.ts";

const identity = { id: true, available: true } as const;

export const PartyIdentityView = view<PartyEntity>()(identity);
export const PartyHeaderView = view<PartyEntity>()({ ...identity, name: true, symbol: true });

export const PartyDetailsView = view<PartyEntity>()({
  ...identity,
  name: true,
  symbol: true,
  description: true,
});

export const PartyCurrencyView = view<PartyEntity>()({ ...identity, currency: true });
export const PartyParticipantsView = view<PartyEntity>()({ ...identity, participants: true });

export const PartyParticipantAmountsView = view<PartyEntity>()({
  ...identity,
  participants: true,
  currency: true,
});

export const PartyMembershipView = view<PartyEntity>()({
  ...identity,
  name: true,
  participants: true,
});

export const PartyHistoryView = view<PartyEntity>()({ ...identity, chunkRefs: true });

export const PartyBalancesView = view<PartyEntity>()({
  ...identity,
  currency: true,
  participants: true,
  chunkRefs: true,
});

export const PartyTransferView = view<PartyEntity>()({
  ...identity,
  symbol: true,
  description: true,
  name: true,
  currency: true,
  participants: true,
});

export const PartyCardView = view<PartyEntity>()({
  ...identity,
  name: true,
  symbol: true,
  description: true,
  participants: true,
});

export const PartySettingsView = view<PartyEntity>()({
  ...identity,
  name: true,
  symbol: true,
  boost: true,
});

export const PartyTemplatesView = view<PartyEntity>()({
  ...identity,
  currency: true,
  participants: true,
  expenseTemplates: true,
  defaultExpenseTemplateId: true,
  onlyUseCustomExpenseTemplates: true,
});

export const ProfileIdentityView = view<ProfileEntity>()(identity);

export const ProfileAppearanceView = view<ProfileEntity>()({
  ...identity,
  locale: true,
  hue: true,
});

export const ProfileMembershipView = view<ProfileEntity>()({
  ...identity,
  participantInParties: true,
});

const profileHomeFields = {
  ...identity,
  parties: true,
  pinnedParties: true,
  archivedParties: true,
  lastUsedAt: true,
  lastOpenedPartyId: true,
  participantInParties: true,
} as const;

export const ProfileHomeView = view<ProfileEntity>()(profileHomeFields);

const profileSettingsFields = {
  ...identity,
  username: true,
  phone: true,
  paymentMethods: true,
  avatarId: true,
  locale: true,
  openLastPartyOnLaunch: true,
  autoOpenCalculator: true,
  hue: true,
} as const;

export const ProfileSettingsView = view<ProfileEntity>()(profileSettingsFields);

export const ProfileCloudView = view<ProfileEntity>()({
  ...profileSettingsFields,
  ...profileHomeFields,
  type: true,
  usageAnalyticsEnabled: true,
});

export const ProfileJoiningView = view<ProfileEntity>()({
  ...identity,
  parties: true,
  participantInParties: true,
  phone: true,
  paymentMethods: true,
  avatarId: true,
});

export const ProfileBannerView = view<ProfileEntity>()({
  ...identity,
  username: true,
  premiumBannerDismissed: true,
});

export const ProfileNameView = view<ProfileEntity>()({ ...identity, username: true });

export const ProfileCalculatorView = view<ProfileEntity>()({
  ...identity,
  autoOpenCalculator: true,
});

export const ProfileAnalyticsView = view<ProfileEntity>()({
  ...identity,
  usageAnalyticsEnabled: true,
});

export const ExpenseIdentityView = view<ExpenseEntity>()(identity);

const expenseDetailFields = {
  ...identity,
  name: true,
  paidAt: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
  __hash: true,
} as const;

export const ExpenseDetailView = view<ExpenseEntity>()(expenseDetailFields);

export const ExpenseEditorView = view<ExpenseEntity>()({
  ...expenseDetailFields,
  __editCopy: true,
  __editCopyLastUpdatedAt: true,
});

export const ExpenseChunkView = view<ExpenseChunkEntity>()({ ...identity, expenses: { id: true } });
export const BalanceView = view<BalanceEntity>()({ ...identity, balances: true });

export const MediaContentView = view<MediaEntity>()({
  ...identity,
  type: true,
  encodedBlob: true,
  metadata: true,
});
