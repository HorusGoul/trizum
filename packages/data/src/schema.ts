import {
  definePermissions,
  schema,
  type CompiledPermissions,
  type InsertOf,
  type RowOf,
} from "jazz-tools";
import type { WasmSchema } from "jazz-tools";

const s = schema;

export const trizumJazzSchema = s.defineSchema({
  users: s
    .table({
      displayName: s.string().optional(),
      phone: s.string().optional(),
      avatarId: s.string().optional(),
      locale: s.enum("en", "es").optional(),
      hue: s.int().optional(),
      openLastPartyOnLaunch: s.boolean().default(false),
      autoOpenCalculator: s.boolean().default(false),
      lastOpenedPartyId: s.string().optional(),
      authMode: s.enum("localFirst", "externalAccount", "cookieAccount").default("localFirst"),
      fullAccountUserId: s.string().optional(),
      accountProvider: s.string().optional(),
    })
    .indexOnly(["fullAccountUserId", "authMode"]),
  parties: s
    .table({
      name: s.string(),
      symbol: s.string().optional(),
      description: s.string().default(""),
      currency: s.string().default("EUR"),
      ownerUserId: s.string(),
      localOnlyInviteSecret: s.string().optional(),
    })
    .indexOnly(["ownerUserId"]),
  partyMembers: s
    .table({
      partyId: s.ref("parties"),
      userId: s.string(),
      participantId: s.ref("participants").optional(),
      role: s.enum("owner", "editor", "viewer").default("editor"),
    })
    .indexOnly(["partyId", "userId"]),
  userPartyStates: s
    .table({
      userId: s.string(),
      partyId: s.ref("parties"),
      participantId: s.ref("participants").optional(),
      isPinned: s.boolean().default(false),
      isArchived: s.boolean().default(false),
      lastUsedAt: s.timestamp().optional(),
    })
    .indexOnly(["userId", "partyId"]),
  participants: s
    .table({
      partyId: s.ref("parties"),
      name: s.string(),
      phone: s.string().optional(),
      avatarId: s.string().optional(),
      isArchived: s.boolean().default(false),
      personalMode: s.boolean().default(false),
      balancesSortedBy: s.enum("name", "balance-ascending", "balance-descending").default("name"),
    })
    .indexOnly(["partyId"]),
  mediaFiles: s
    .table({
      ownerUserId: s.string(),
      partyId: s.ref("parties").optional(),
      encodedBlob: s.string(),
      metadata: s.json().default({}),
    })
    .indexOnly(["ownerUserId", "partyId"]),
  expenseChunks: s
    .table({
      partyId: s.ref("parties"),
      createdAt: s.timestamp(),
      maxSize: s.int().default(500),
    })
    .indexOnly(["partyId", "createdAt"]),
  expenseChunkBalances: s
    .table({
      partyId: s.ref("parties"),
      chunkId: s.ref("expenseChunks"),
      balances: s.json().default({}),
    })
    .indexOnly(["partyId", "chunkId"]),
  expenses: s
    .table({
      partyId: s.ref("parties"),
      chunkId: s.ref("expenseChunks").optional(),
      name: s.string(),
      paidAt: s.timestamp(),
      amount: s.int(),
      paidBy: s.json().default({}),
      shares: s.json().default({}),
      photos: s.array(s.string()).default([]),
      isTransfer: s.boolean().default(false),
      internalMemo: s.string().optional(),
      hash: s.string().optional(),
      editCopy: s.json().optional(),
      editCopyLastUpdatedAt: s.timestamp().optional(),
    })
    .indexOnly(["partyId", "chunkId", "paidAt"]),
});

export const trizumJazzApp = s.defineApp(trizumJazzSchema);

export type UserRow = RowOf<typeof trizumJazzApp.users>;
export type PartyRow = RowOf<typeof trizumJazzApp.parties>;
export type PartyMemberRow = RowOf<typeof trizumJazzApp.partyMembers>;
export type UserPartyStateRow = RowOf<typeof trizumJazzApp.userPartyStates>;
export type ParticipantRow = RowOf<typeof trizumJazzApp.participants>;
export type MediaFileRow = RowOf<typeof trizumJazzApp.mediaFiles>;
export type ExpenseChunkRow = RowOf<typeof trizumJazzApp.expenseChunks>;
export type ExpenseChunkBalancesRow = RowOf<typeof trizumJazzApp.expenseChunkBalances>;
export type ExpenseRow = RowOf<typeof trizumJazzApp.expenses>;

export type CreateUserInput = InsertOf<typeof trizumJazzApp.users>;
export type CreatePartyInput = InsertOf<typeof trizumJazzApp.parties>;
export type CreatePartyMemberInput = InsertOf<typeof trizumJazzApp.partyMembers>;
export type CreateUserPartyStateInput = InsertOf<typeof trizumJazzApp.userPartyStates>;
export type CreateParticipantInput = InsertOf<typeof trizumJazzApp.participants>;
export type CreateMediaFileInput = InsertOf<typeof trizumJazzApp.mediaFiles>;
export type CreateExpenseChunkInput = InsertOf<typeof trizumJazzApp.expenseChunks>;
export type CreateExpenseChunkBalancesInput = InsertOf<typeof trizumJazzApp.expenseChunkBalances>;
export type CreateExpenseInput = InsertOf<typeof trizumJazzApp.expenses>;

export const trizumJazzPermissions = definePermissions(
  trizumJazzApp,
  ({ allowedTo, anyOf, policy, session }) => [
    policy.users.allowRead.where({ id: session.userId }),
    policy.users.allowInsert.where({ id: session.userId }),
    policy.users.allowUpdate.whereOld({ id: session.userId }).whereNew({ id: session.userId }),
    policy.users.allowDelete.where({ id: session.userId }),

    policy.parties.allowRead.where((party) =>
      anyOf([
        { ownerUserId: session.userId },
        policy.partyMembers.exists.where({
          partyId: party.id,
          userId: session.userId,
        }),
      ]),
    ),
    policy.parties.allowInsert.where({ ownerUserId: session.userId }),
    policy.parties.allowUpdate
      .whereOld({ ownerUserId: session.userId })
      .whereNew({ ownerUserId: session.userId }),
    policy.parties.allowDelete.where({ ownerUserId: session.userId }),

    policy.partyMembers.allowRead.where(
      anyOf([{ userId: session.userId }, allowedTo.update("partyId")]),
    ),
    policy.partyMembers.allowInsert.where(allowedTo.update("partyId")),
    policy.partyMembers.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.partyMembers.allowDelete.where(allowedTo.update("partyId")),

    policy.userPartyStates.allowRead.where({ userId: session.userId }),
    policy.userPartyStates.allowInsert.where({ userId: session.userId }),
    policy.userPartyStates.allowUpdate
      .whereOld({ userId: session.userId })
      .whereNew({ userId: session.userId }),
    policy.userPartyStates.allowDelete.where({ userId: session.userId }),

    policy.participants.allowRead.where(allowedTo.read("partyId")),
    policy.participants.allowInsert.where(allowedTo.update("partyId")),
    policy.participants.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.participants.allowDelete.where(allowedTo.update("partyId")),

    policy.mediaFiles.allowRead.where(
      anyOf([{ ownerUserId: session.userId }, allowedTo.read("partyId")]),
    ),
    policy.mediaFiles.allowInsert.where({ ownerUserId: session.userId }),
    policy.mediaFiles.allowUpdate
      .whereOld({ ownerUserId: session.userId })
      .whereNew({ ownerUserId: session.userId }),
    policy.mediaFiles.allowDelete.where({ ownerUserId: session.userId }),

    policy.expenseChunks.allowRead.where(allowedTo.read("partyId")),
    policy.expenseChunks.allowInsert.where(allowedTo.update("partyId")),
    policy.expenseChunks.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.expenseChunks.allowDelete.where(allowedTo.update("partyId")),

    policy.expenseChunkBalances.allowRead.where(allowedTo.read("partyId")),
    policy.expenseChunkBalances.allowInsert.where(allowedTo.update("partyId")),
    policy.expenseChunkBalances.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.expenseChunkBalances.allowDelete.where(allowedTo.update("partyId")),

    policy.expenses.allowRead.where(allowedTo.read("partyId")),
    policy.expenses.allowInsert.where(allowedTo.update("partyId")),
    policy.expenses.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.expenses.allowDelete.where(allowedTo.update("partyId")),
  ],
);

export const trizumJazzWasmSchema = applyPermissionsToWasmSchema(
  trizumJazzApp.wasmSchema,
  trizumJazzPermissions,
);

function applyPermissionsToWasmSchema(
  wasmSchema: WasmSchema,
  permissions: CompiledPermissions,
): WasmSchema {
  for (const [tableName, tableSchema] of Object.entries(wasmSchema)) {
    tableSchema.policies = permissions[tableName] as typeof tableSchema.policies;
  }

  return wasmSchema;
}
