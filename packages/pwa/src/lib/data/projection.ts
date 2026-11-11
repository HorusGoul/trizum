import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import type { PartyList } from "#src/models/partyList.ts";
import type { Expense } from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";

export type SourceDocument =
  | Party
  | PartyList
  | PartyExpenseChunk
  | PartyExpenseChunkBalances
  | MediaFile;

export const entityTypes = [
  {
    type: "Party",
    fields: {
      participants: "scalar",
      chunkRefs: "scalar",
      expenseTemplates: "scalar",
      boost: "scalar",
    },
  },
  {
    type: "Profile",
    fields: {
      parties: "scalar",
      pinnedParties: "scalar",
      archivedParties: "scalar",
      lastUsedAt: "scalar",
      participantInParties: "scalar",
      paymentMethods: "scalar",
    },
  },
  { type: "ExpenseChunk", fields: { expenses: { listOf: "Expense" } } },
  {
    type: "Expense",
    fields: { paidBy: "scalar", shares: "scalar", photos: "scalar", __editCopy: "scalar" },
  },
  { type: "Balance", fields: { balances: "scalar" } },
  { type: "Media", fields: { encodedBlob: "scalar", metadata: "scalar" } },
] as const;

export function projectParty(id: string, party?: Party) {
  return {
    __typename: "Party",
    id,
    available: Boolean(party),
    type: party?.type,
    name: party?.name,
    symbol: party?.symbol,
    description: party?.description,
    currency: party?.currency,
    participants: party?.participants,
    chunkRefs: party?.chunkRefs,
    expenseTemplates: party?.expenseTemplates,
    defaultExpenseTemplateId: party?.defaultExpenseTemplateId,
    onlyUseCustomExpenseTemplates: party?.onlyUseCustomExpenseTemplates,
    boost: party?.boost,
  };
}

export function projectProfile(id: string, profile?: PartyList) {
  return {
    __typename: "Profile",
    id,
    available: Boolean(profile),
    type: profile?.type,
    username: profile?.username,
    phone: profile?.phone,
    paymentMethods: profile?.paymentMethods,
    avatarId: profile?.avatarId,
    locale: profile?.locale,
    openLastPartyOnLaunch: profile?.openLastPartyOnLaunch,
    autoOpenCalculator: profile?.autoOpenCalculator,
    usageAnalyticsEnabled: profile?.usageAnalyticsEnabled,
    telemetryId: profile?.telemetryId,
    premiumBannerDismissed: profile?.premiumBannerDismissed,
    hue: profile?.hue,
    lastOpenedPartyId: profile?.lastOpenedPartyId,
    parties: profile?.parties,
    pinnedParties: profile?.pinnedParties,
    archivedParties: profile?.archivedParties,
    lastUsedAt: profile?.lastUsedAt,
    participantInParties: profile?.participantInParties,
  };
}

export function projectExpense(id: string, expense?: Expense) {
  return {
    __typename: "Expense",
    id,
    available: Boolean(expense),
    name: expense?.name,
    paidAt: expense?.paidAt,
    paidBy: expense?.paidBy,
    shares: expense?.shares,
    photos: expense?.photos,
    isTransfer: expense?.isTransfer,
    __hash: expense?.__hash,
    __editCopy: expense?.__editCopy,
    __editCopyLastUpdatedAt: expense?.__editCopyLastUpdatedAt,
  };
}

export function projectChunk(id: string, chunk?: PartyExpenseChunk) {
  return {
    __typename: "ExpenseChunk",
    id,
    available: Boolean(chunk),
    type: chunk?.type,
    createdAt: chunk?.createdAt,
    maxSize: chunk?.maxSize,
    partyId: chunk?.partyId,
    expenses: (chunk?.expenses ?? []).map((expense) => projectExpense(expense.id, expense)),
  };
}

export function projectBalance(id: string, balance?: PartyExpenseChunkBalances) {
  return {
    __typename: "Balance",
    id,
    available: Boolean(balance),
    type: balance?.type,
    partyId: balance?.partyId,
    balances: balance?.balances,
  };
}

export function projectMedia(id: string, media?: MediaFile) {
  return {
    __typename: "Media",
    id,
    available: Boolean(media),
    type: media?.type,
    encodedBlob: media?.encodedBlob,
    metadata: media?.metadata,
  };
}

export const expenseFields = Object.keys(projectExpense(""));

export const chunkFields = [
  ...Object.keys(projectChunk("")),
  ...expenseFields.map((field) => `expenses.${field}`),
];

export function projectDocument(type: string, id: string, source: SourceDocument | undefined) {
  switch (type) {
    case "Party":
      return projectParty(id, source?.type === "party" ? source : undefined);
    case "Profile":
      return projectProfile(id, source?.type === "partyList" ? source : undefined);
    case "ExpenseChunk":
      return projectChunk(id, source?.type === "expenseChunk" ? source : undefined);
    case "Expense":
      return projectExpense(
        id,
        source?.type === "expenseChunk"
          ? source.expenses.find((expense) => expense.id === id)
          : undefined,
      );
    case "Balance":
      return projectBalance(id, source?.type === "expenseChunkBalances" ? source : undefined);
    case "Media":
      return projectMedia(id, source?.type === "mediaFile" ? source : undefined);
    default:
      throw new Error("Unknown data entity");
  }
}
