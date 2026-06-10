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
  localFirstUsers: s
    .table({
      displayName: s.string().optional(),
      fullAccountUserId: s.string().optional(),
      accountProvider: s.string().optional(),
    })
    .indexOnly(["fullAccountUserId"]),
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
  participants: s
    .table({
      partyId: s.ref("parties"),
      name: s.string(),
      phone: s.string().optional(),
      avatarId: s.string().optional(),
      isArchived: s.boolean().default(false),
      personalMode: s.boolean().default(false),
    })
    .indexOnly(["partyId"]),
  expenses: s
    .table({
      partyId: s.ref("parties"),
      name: s.string(),
      paidAt: s.timestamp(),
      amount: s.int(),
      paidBy: s.json().default({}),
      shares: s.json().default({}),
      photos: s.array(s.string()).default([]),
      isTransfer: s.boolean().default(false),
      internalMemo: s.string().optional(),
    })
    .indexOnly(["partyId", "paidAt"]),
});

export const trizumJazzApp = s.defineApp(trizumJazzSchema);

export type LocalFirstUserRow = RowOf<typeof trizumJazzApp.localFirstUsers>;
export type PartyRow = RowOf<typeof trizumJazzApp.parties>;
export type PartyMemberRow = RowOf<typeof trizumJazzApp.partyMembers>;
export type ParticipantRow = RowOf<typeof trizumJazzApp.participants>;
export type ExpenseRow = RowOf<typeof trizumJazzApp.expenses>;

export type CreatePartyInput = InsertOf<typeof trizumJazzApp.parties>;
export type CreateParticipantInput = InsertOf<typeof trizumJazzApp.participants>;
export type CreateExpenseInput = InsertOf<typeof trizumJazzApp.expenses>;

export const trizumJazzPermissions = definePermissions(
  trizumJazzApp,
  ({ allowedTo, anyOf, policy, session }) => [
    policy.localFirstUsers.allowRead.where({ id: session.userId }),
    policy.localFirstUsers.allowInsert.where({ id: session.userId }),
    policy.localFirstUsers.allowUpdate
      .whereOld({ id: session.userId })
      .whereNew({ id: session.userId }),
    policy.localFirstUsers.allowDelete.where({ id: session.userId }),

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

    policy.participants.allowRead.where(allowedTo.read("partyId")),
    policy.participants.allowInsert.where(allowedTo.update("partyId")),
    policy.participants.allowUpdate
      .whereOld(allowedTo.update("partyId"))
      .whereNew(allowedTo.update("partyId")),
    policy.participants.allowDelete.where(allowedTo.update("partyId")),

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
