import type { MutationInput, MutationResult } from "@nkzw/fate";
import { isValidDocumentId, type Repo, type DocumentId } from "@automerge/automerge-repo/slim";
import type { Party, PartyExpenseChunk } from "#src/models/party.ts";
import { decodeExpenseId, calculateExpenseHash } from "#src/models/expense.ts";
import { createPartyFromMigrationData } from "#src/models/migration.ts";
import { getMediaFileHelpers } from "./mediaCommands.ts";
import { getOrCreateExpenseEditCopy } from "./expenseDraft.ts";
import { patchMutate } from "../patchMutate.ts";
import type { appMutations } from "./schema.ts";
import { type PartyCommands, type ProfileCommands } from "./schema.ts";
import type { ExpensePresenceMessage } from "./presence.ts";
import type { ImportProgressEntity } from "./entities.ts";

type Handlers = {
  [Name in keyof typeof appMutations]: (
    input: MutationInput<(typeof appMutations)[Name]>,
  ) =>
    | MutationResult<(typeof appMutations)[Name]>
    | Promise<MutationResult<(typeof appMutations)[Name]>>;
};

export function createMutationHandlers(
  repo: Repo,
  source: {
    party(id: string): Promise<PartyCommands>;
    profile(id: string): Promise<ProfileCommands>;
    loadNext(id: string): Promise<void>;
    broadcast(message: ExpensePresenceMessage): Promise<void>;
    progress(value: ImportProgressEntity): void;
  },
): Handlers {
  return {
    "party.updateDetails": async ({ partyId, parameters }) =>
      (await source.party(partyId)).updateDetails(...parameters),
    "party.updateParticipants": async ({ partyId, parameters }) =>
      (await source.party(partyId)).updateParticipants(...parameters),
    "party.setParticipantDetails": async ({ partyId, parameters }) =>
      (await source.party(partyId)).setParticipantDetails(...parameters),
    "party.saveExpenseTemplate": async ({ partyId, parameters }) =>
      (await source.party(partyId)).saveExpenseTemplate(...parameters),
    "party.deleteExpenseTemplate": async ({ partyId, parameters }) =>
      (await source.party(partyId)).deleteExpenseTemplate(...parameters),
    "party.setOnlyUseCustomExpenseTemplates": async ({ partyId, parameters }) =>
      (await source.party(partyId)).setOnlyUseCustomExpenseTemplates(...parameters),
    "party.setDefaultExpenseTemplate": async ({ partyId, parameters }) =>
      (await source.party(partyId)).setDefaultExpenseTemplate(...parameters),
    "party.addExpenseToParty": async ({ partyId, parameters }) =>
      (await source.party(partyId)).addExpenseToParty(...parameters),
    "party.transferDebtToParty": async ({ partyId, parameters }) =>
      (await source.party(partyId)).transferDebtToParty(...parameters),
    "party.updateExpense": async ({ partyId, parameters }) =>
      (await source.party(partyId)).updateExpense(...parameters),
    "party.removeExpense": async ({ partyId, parameters }) =>
      (await source.party(partyId)).removeExpense(...parameters),
    "party.recalculateBalances": async ({ partyId, parameters }) =>
      (await source.party(partyId)).recalculateBalances(...parameters),
    "profile.addPartyToList": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).addPartyToList(...parameters),
    "profile.removeParty": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).removeParty(...parameters),
    "profile.updateSettings": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).updateSettings(...parameters),
    "profile.setLastOpenedPartyId": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).setLastOpenedPartyId(...parameters),
    "profile.setPartyPinned": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).setPartyPinned(...parameters),
    "profile.setPartyArchived": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).setPartyArchived(...parameters),
    "profile.setAutoOpenCalculator": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).setAutoOpenCalculator(...parameters),
    "profile.setUsageAnalyticsEnabled": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).setUsageAnalyticsEnabled(...parameters),
    "profile.dismissPremiumBanner": async ({ profileId, parameters }) =>
      (await source.profile(profileId)).dismissPremiumBanner(...parameters),
    "party.create": async (values) => {
      // SAFETY: Repo assigns the real ID before the new document is exposed.
      const handle = repo.create<Party>({
        ...values,
        id: "" as DocumentId,
        type: "party",
        chunkRefs: [],
      });

      handle.change((doc) => {
        doc.id = handle.documentId;
      });
      await repo.flush([handle.documentId]);

      return handle.documentId;
    },
    "party.import": async ({ operationId, ...options }) => {
      return createPartyFromMigrationData({
        ...options,
        repo,
        onProgress: (progress) =>
          source.progress({ __typename: "ImportProgress", id: operationId, ...progress }),
      });
    },
    "party.createTestExpenses": async ({ partyId, count }) => {
      if (!isValidDocumentId(partyId)) throw new Error("Malformed record ID");
      const helpers = await source.party(partyId);
      const handle = await repo.find<Party>(partyId);
      const participants = Object.keys(handle.doc().participants);
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          helpers.addExpenseToParty({
            name: `Test Expense ${index + 1}`,
            paidAt: new Date(),
            photos: [],
            paidBy: { [participants[0]]: 100 },
            shares: {
              [participants[0]]: { type: "divide", value: 1 },
              [participants[1]]: { type: "divide", value: 1 },
            },
          }),
        ),
      );
    },
    "media.create": async ({ parameters }) => {
      const [id] = await getMediaFileHelpers(repo).createMediaFile(...parameters);
      await repo.flush([id]);

      return [id] as const;
    },
    "expense.editDraft": async ({ expenseId, patches }) => {
      const handle = await repo.find<PartyExpenseChunk>(decodeExpenseId(expenseId).chunkId);
      handle.change((chunk) => {
        const entry = chunk.expenses.find(({ id }) => id === expenseId);

        if (!entry) return;
        const editCopy = getOrCreateExpenseEditCopy(entry);
        patchMutate(editCopy, patches);
        editCopy.__hash = calculateExpenseHash(editCopy);
        entry.__editCopyLastUpdatedAt = new Date();
      });
    },
    "expenseHistory.loadNext": ({ partyId }) => source.loadNext(partyId),
    "presence.broadcast": (message) => source.broadcast(message),
  } satisfies Handlers;
}
