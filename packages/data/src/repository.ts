import {
  createJazzDbRepository,
  projectEntity,
  type JazzFateDb,
  type JazzFateEntityDefinition,
  type JazzFateListDefinition,
  type JazzFateListResult,
  type JazzFateMutationDefinition,
  type JazzFateRepository,
} from "fate-jazz";
import { trizumJazzApp } from "./schema.js";
import type {
  CreateExpenseMutationInput,
  CreateJoinedPartyMutationInput,
  CreateMediaFileMutationInput,
  CreatePartyMemberMutationInput,
  CreateParticipantMutationInput,
  CreatePartyMutationInput,
  CreateUserMutationInput,
  ExpenseEntity,
  JoinedPartyEntity,
  MediaFileEntity,
  PartyMemberEntity,
  ParticipantEntity,
  PartyEntity,
  TrizumFateEntity,
  TrizumFateTypename,
  UserEntity,
  UpsertExpenseMutationInput,
  UpsertJoinedPartyMutationInput,
  UpsertMediaFileMutationInput,
  UpsertParticipantMutationInput,
  UpsertPartyMemberMutationInput,
  UpsertPartyMutationInput,
  UpsertUserMutationInput,
} from "./views.js";

export type TrizumFateListRoot =
  | "expenses"
  | "joinedParties"
  | "mediaFiles"
  | "participants"
  | "parties"
  | "partyMembers"
  | "users";

export type TrizumFateMutationMap = {
  "user.create": {
    input: CreateUserMutationInput;
    output: UserEntity;
  };
  "user.upsert": {
    input: UpsertUserMutationInput;
    output: UserEntity;
  };
  "party.create": {
    input: CreatePartyMutationInput;
    output: PartyEntity;
  };
  "party.upsert": {
    input: UpsertPartyMutationInput;
    output: PartyEntity;
  };
  "partyMember.create": {
    input: CreatePartyMemberMutationInput;
    output: PartyMemberEntity;
  };
  "partyMember.upsert": {
    input: UpsertPartyMemberMutationInput;
    output: PartyMemberEntity;
  };
  "joinedParty.create": {
    input: CreateJoinedPartyMutationInput;
    output: JoinedPartyEntity;
  };
  "joinedParty.upsert": {
    input: UpsertJoinedPartyMutationInput;
    output: JoinedPartyEntity;
  };
  "participant.create": {
    input: CreateParticipantMutationInput;
    output: ParticipantEntity;
  };
  "participant.upsert": {
    input: UpsertParticipantMutationInput;
    output: ParticipantEntity;
  };
  "mediaFile.create": {
    input: CreateMediaFileMutationInput;
    output: MediaFileEntity;
  };
  "mediaFile.upsert": {
    input: UpsertMediaFileMutationInput;
    output: MediaFileEntity;
  };
  "mediaFile.delete": {
    input: { id: string };
    output: MediaFileEntity;
  };
  "expense.create": {
    input: CreateExpenseMutationInput;
    output: ExpenseEntity;
  };
  "expense.upsert": {
    input: UpsertExpenseMutationInput;
    output: ExpenseEntity;
  };
  "expense.delete": {
    input: { id: string };
    output: ExpenseEntity;
  };
};

export type TrizumDataRepository = JazzFateRepository<TrizumFateEntity, TrizumFateMutationMap>;

export type TrizumDataRepositoryListResult = JazzFateListResult<TrizumFateEntity>;

export const trizumEntityDefinitions = [
  {
    columns: [
      "id",
      "displayName",
      "phone",
      "avatarId",
      "locale",
      "hue",
      "openLastPartyOnLaunch",
      "autoOpenCalculator",
      "lastOpenedPartyId",
      "authMode",
      "accountProvider",
    ],
    table: trizumJazzApp.users,
    type: "User",
  },
  {
    columns: [
      "id",
      "name",
      "symbol",
      "description",
      "currency",
      "ownerUserId",
      "localOnlyInviteSecret",
    ],
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    columns: ["id", "partyId", "userId", "participantId", "role"],
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    columns: [
      "id",
      "userId",
      "partyId",
      "participantId",
      "isPinned",
      "isArchived",
      "joinedAt",
      "lastUsedAt",
    ],
    table: trizumJazzApp.joinedParties,
    type: "JoinedParty",
  },
  {
    columns: [
      "id",
      "partyId",
      "name",
      "phone",
      "avatarId",
      "isArchived",
      "personalMode",
      "balancesSortedBy",
    ],
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    columns: ["id", "ownerUserId", "partyId", "encodedBlob", "metadata"],
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    columns: [
      "id",
      "partyId",
      "name",
      "paidAt",
      "amount",
      "paidBy",
      "shares",
      "photos",
      "isTransfer",
      "internalMemo",
      "hash",
      "editCopy",
      "editCopyLastUpdatedAt",
    ],
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
] as const satisfies readonly JazzFateEntityDefinition<TrizumFateEntity>[];

export const trizumListDefinitions = [
  {
    root: "users",
    type: "User",
  },
  {
    root: "parties",
    type: "Party",
  },
  {
    root: "partyMembers",
    type: "PartyMember",
    where: partyScopedWhere,
  },
  {
    root: "joinedParties",
    type: "JoinedParty",
    where: userOrPartyScopedWhere,
  },
  {
    root: "participants",
    type: "Participant",
    where: partyScopedWhere,
  },
  {
    root: "mediaFiles",
    type: "MediaFile",
    where: userOrPartyScopedWhere,
  },
  {
    orderBy: {
      column: "paidAt",
      direction: "desc",
    },
    pagination: "offset",
    root: "expenses",
    type: "Expense",
    where: partyScopedWhere,
  },
] as const satisfies readonly JazzFateListDefinition<TrizumFateEntity>[];

export const trizumMutationDefinitions = [
  {
    proc: "user.create",
    table: trizumJazzApp.users,
    type: "User",
  },
  {
    operation: "upsert",
    proc: "user.upsert",
    table: trizumJazzApp.users,
    type: "User",
  },
  {
    proc: "party.create",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    operation: "upsert",
    proc: "party.upsert",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    proc: "partyMember.create",
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    operation: "upsert",
    proc: "partyMember.upsert",
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    proc: "joinedParty.create",
    table: trizumJazzApp.joinedParties,
    type: "JoinedParty",
  },
  {
    operation: "upsert",
    proc: "joinedParty.upsert",
    table: trizumJazzApp.joinedParties,
    type: "JoinedParty",
  },
  {
    proc: "participant.create",
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    operation: "upsert",
    proc: "participant.upsert",
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    proc: "mediaFile.create",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    operation: "upsert",
    proc: "mediaFile.upsert",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    operation: "delete",
    proc: "mediaFile.delete",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    proc: "expense.create",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
  {
    operation: "upsert",
    proc: "expense.upsert",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
  {
    operation: "delete",
    proc: "expense.delete",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
] as const satisfies readonly JazzFateMutationDefinition<TrizumFateEntity>[];

const columnsByType = new Map<TrizumFateTypename, readonly string[]>(
  trizumEntityDefinitions.map((definition) => [definition.type, definition.columns]),
);

export function createTrizumJazzRepository(db: JazzFateDb): TrizumDataRepository {
  return createJazzDbRepository<TrizumFateEntity, TrizumFateMutationMap>({
    db,
    entities: trizumEntityDefinitions,
    lists: trizumListDefinitions,
    mutations: trizumMutationDefinitions,
  });
}

export function projectTrizumEntity<T extends TrizumFateEntity>(
  entity: T,
  select: Iterable<string>,
): T {
  const columns = columnsByType.get(entity.__typename);

  if (!columns) {
    throw new Error(`Unsupported Trizum Fate entity type: ${entity.__typename}`);
  }

  return projectEntity(entity, select, columns);
}

function partyScopedWhere(args?: Record<string, unknown>) {
  if (typeof args?.partyId !== "string") {
    return undefined;
  }

  return {
    partyId: args.partyId,
  };
}

function userOrPartyScopedWhere(args?: Record<string, unknown>) {
  if (typeof args?.partyId === "string") {
    return {
      partyId: args.partyId,
    };
  }

  if (typeof args?.userId === "string") {
    return {
      userId: args.userId,
    };
  }

  if (typeof args?.ownerUserId === "string") {
    return {
      ownerUserId: args.ownerUserId,
    };
  }

  return undefined;
}
