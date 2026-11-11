import { clientRoot, valueMutation } from "@nkzw/fate";
import type { getPartyHelpers } from "./partyCommands.ts";
import type { getProfileHelpers } from "./profileCommands.ts";
import type { getMediaFileHelpers } from "./mediaCommands.ts";
import type { Party } from "#src/models/party.ts";
import type { createPartyFromMigrationData } from "#src/models/migration.ts";
import type { DiffResult } from "@opentf/obj-diff";
import type { ExpensePresenceMessage } from "./presence.ts";
import type {
  PartyEntity,
  ProfileEntity,
  ExpenseEntity,
  ExpenseChunkEntity,
  BalanceEntity,
  MediaEntity,
  SessionEntity,
  ExpenseHistoryEntity,
  ExpensePresenceEntity,
  ImportProgressEntity,
} from "./entities.ts";

export interface RecordSnapshot {
  __typename: "RecordSnapshot";
  id: string;
  value: object | null;
}

export type PartyCommands = ReturnType<typeof getPartyHelpers>;

export type ProfileCommands = ReturnType<typeof getProfileHelpers>;

type PartyInput<Name extends keyof PartyCommands> = {
  partyId: string;
  parameters: Parameters<PartyCommands[Name]>;
};

type PartyResult<Name extends keyof PartyCommands> = Awaited<ReturnType<PartyCommands[Name]>>;

type ProfileInput<Name extends keyof ProfileCommands> = {
  profileId: string;
  parameters: Parameters<ProfileCommands[Name]>;
};

type ProfileResult<Name extends keyof ProfileCommands> = Awaited<ReturnType<ProfileCommands[Name]>>;

export const appRoots = {
  record: clientRoot<RecordSnapshot, "RecordSnapshot", { id: string }>("RecordSnapshot"),
  party: clientRoot<PartyEntity, "Party">("Party"),
  profile: clientRoot<ProfileEntity, "Profile">("Profile"),
  expense: clientRoot<ExpenseEntity, "Expense">("Expense"),
  expenseChunk: clientRoot<ExpenseChunkEntity, "ExpenseChunk">("ExpenseChunk"),
  balance: clientRoot<BalanceEntity, "Balance">("Balance"),
  media: clientRoot<MediaEntity, "Media">("Media"),
  session: clientRoot<SessionEntity, "Session">("Session"),
  expenseHistory: clientRoot<ExpenseHistoryEntity, "ExpenseHistory">("ExpenseHistory"),
  expensePresence: clientRoot<ExpensePresenceEntity, "ExpensePresence">("ExpensePresence"),
  importProgress: clientRoot<ImportProgressEntity, "ImportProgress">("ImportProgress"),
};

export const appMutations = {
  "party.updateDetails": valueMutation<PartyInput<"updateDetails">, PartyResult<"updateDetails">>(),
  "party.updateParticipants": valueMutation<
    PartyInput<"updateParticipants">,
    PartyResult<"updateParticipants">
  >(),
  "party.setParticipantDetails": valueMutation<
    PartyInput<"setParticipantDetails">,
    PartyResult<"setParticipantDetails">
  >(),
  "party.saveExpenseTemplate": valueMutation<
    PartyInput<"saveExpenseTemplate">,
    PartyResult<"saveExpenseTemplate">
  >(),
  "party.deleteExpenseTemplate": valueMutation<
    PartyInput<"deleteExpenseTemplate">,
    PartyResult<"deleteExpenseTemplate">
  >(),
  "party.setOnlyUseCustomExpenseTemplates": valueMutation<
    PartyInput<"setOnlyUseCustomExpenseTemplates">,
    PartyResult<"setOnlyUseCustomExpenseTemplates">
  >(),
  "party.setDefaultExpenseTemplate": valueMutation<
    PartyInput<"setDefaultExpenseTemplate">,
    PartyResult<"setDefaultExpenseTemplate">
  >(),
  "party.addExpenseToParty": valueMutation<
    PartyInput<"addExpenseToParty">,
    PartyResult<"addExpenseToParty">
  >(),
  "party.transferDebtToParty": valueMutation<
    PartyInput<"transferDebtToParty">,
    PartyResult<"transferDebtToParty">
  >(),
  "party.updateExpense": valueMutation<PartyInput<"updateExpense">, PartyResult<"updateExpense">>(),
  "party.removeExpense": valueMutation<PartyInput<"removeExpense">, PartyResult<"removeExpense">>(),
  "party.recalculateBalances": valueMutation<
    PartyInput<"recalculateBalances">,
    PartyResult<"recalculateBalances">
  >(),
  "profile.addPartyToList": valueMutation<
    ProfileInput<"addPartyToList">,
    ProfileResult<"addPartyToList">
  >(),
  "profile.removeParty": valueMutation<ProfileInput<"removeParty">, ProfileResult<"removeParty">>(),
  "profile.updateSettings": valueMutation<
    ProfileInput<"updateSettings">,
    ProfileResult<"updateSettings">
  >(),
  "profile.setLastOpenedPartyId": valueMutation<
    ProfileInput<"setLastOpenedPartyId">,
    ProfileResult<"setLastOpenedPartyId">
  >(),
  "profile.setPartyPinned": valueMutation<
    ProfileInput<"setPartyPinned">,
    ProfileResult<"setPartyPinned">
  >(),
  "profile.setPartyArchived": valueMutation<
    ProfileInput<"setPartyArchived">,
    ProfileResult<"setPartyArchived">
  >(),
  "profile.setAutoOpenCalculator": valueMutation<
    ProfileInput<"setAutoOpenCalculator">,
    ProfileResult<"setAutoOpenCalculator">
  >(),
  "profile.setUsageAnalyticsEnabled": valueMutation<
    ProfileInput<"setUsageAnalyticsEnabled">,
    ProfileResult<"setUsageAnalyticsEnabled">
  >(),
  "profile.dismissPremiumBanner": valueMutation<
    ProfileInput<"dismissPremiumBanner">,
    ProfileResult<"dismissPremiumBanner">
  >(),
  "party.create": valueMutation<Omit<Party, "id" | "type" | "chunkRefs">, Party["id"]>(),
  "party.import": valueMutation<
    Omit<Parameters<typeof createPartyFromMigrationData>[0], "repo" | "onProgress"> & {
      operationId: string;
    },
    Party["id"]
  >(),
  "party.createTestExpenses": valueMutation<{ partyId: string; count: number }, void>(),
  "media.create": valueMutation<
    { parameters: Parameters<ReturnType<typeof getMediaFileHelpers>["createMediaFile"]> },
    readonly [MediaEntity["id"]]
  >(),
  "expense.editDraft": valueMutation<{ expenseId: string; patches: DiffResult[] }, void>(),
  "expenseHistory.loadNext": valueMutation<{ partyId: Party["id"] }, void>(),
  "presence.broadcast": valueMutation<ExpensePresenceMessage, void>(),
};
