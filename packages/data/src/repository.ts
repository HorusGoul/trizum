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
  CreateExpenseChunkBalancesMutationInput,
  CreateExpenseChunkMutationInput,
  CreateExpenseMutationInput,
  CreateMediaFileMutationInput,
  CreatePartyMemberMutationInput,
  CreateParticipantMutationInput,
  CreatePartyMutationInput,
  CreateUserMutationInput,
  CreateUserPartyStateMutationInput,
  ExpenseChunkBalancesEntity,
  ExpenseChunkEntity,
  ExpenseEntity,
  MediaFileEntity,
  PartyMemberEntity,
  ParticipantEntity,
  PartyEntity,
  TrizumFateEntity,
  TrizumFateTypename,
  UserEntity,
  UserPartyStateEntity,
} from "./views.js";

export type TrizumFateListRoot =
  | "expenseChunkBalances"
  | "expenseChunks"
  | "expenses"
  | "mediaFiles"
  | "participants"
  | "parties"
  | "partyMembers"
  | "userPartyStates"
  | "users";

export type TrizumFateMutationMap = {
  "user.create": {
    input: CreateUserMutationInput;
    output: UserEntity;
  };
  "party.create": {
    input: CreatePartyMutationInput;
    output: PartyEntity;
  };
  "partyMember.create": {
    input: CreatePartyMemberMutationInput;
    output: PartyMemberEntity;
  };
  "userPartyState.create": {
    input: CreateUserPartyStateMutationInput;
    output: UserPartyStateEntity;
  };
  "participant.create": {
    input: CreateParticipantMutationInput;
    output: ParticipantEntity;
  };
  "mediaFile.create": {
    input: CreateMediaFileMutationInput;
    output: MediaFileEntity;
  };
  "expenseChunk.create": {
    input: CreateExpenseChunkMutationInput;
    output: ExpenseChunkEntity;
  };
  "expenseChunkBalances.create": {
    input: CreateExpenseChunkBalancesMutationInput;
    output: ExpenseChunkBalancesEntity;
  };
  "expense.create": {
    input: CreateExpenseMutationInput;
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
    columns: ["id", "userId", "partyId", "participantId", "isPinned", "isArchived", "lastUsedAt"],
    table: trizumJazzApp.userPartyStates,
    type: "UserPartyState",
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
    columns: ["id", "partyId", "createdAt", "maxSize"],
    table: trizumJazzApp.expenseChunks,
    type: "ExpenseChunk",
  },
  {
    columns: ["id", "partyId", "chunkId", "balances"],
    table: trizumJazzApp.expenseChunkBalances,
    type: "ExpenseChunkBalances",
  },
  {
    columns: [
      "id",
      "partyId",
      "chunkId",
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
    root: "userPartyStates",
    type: "UserPartyState",
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
      column: "createdAt",
      direction: "desc",
    },
    root: "expenseChunks",
    type: "ExpenseChunk",
    where: partyScopedWhere,
  },
  {
    root: "expenseChunkBalances",
    type: "ExpenseChunkBalances",
    where: chunkOrPartyScopedWhere,
  },
  {
    orderBy: {
      column: "paidAt",
      direction: "desc",
    },
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
    proc: "party.create",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    proc: "partyMember.create",
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    proc: "userPartyState.create",
    table: trizumJazzApp.userPartyStates,
    type: "UserPartyState",
  },
  {
    proc: "participant.create",
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    proc: "mediaFile.create",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    proc: "expenseChunk.create",
    table: trizumJazzApp.expenseChunks,
    type: "ExpenseChunk",
  },
  {
    proc: "expenseChunkBalances.create",
    table: trizumJazzApp.expenseChunkBalances,
    type: "ExpenseChunkBalances",
  },
  {
    proc: "expense.create",
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

function chunkOrPartyScopedWhere(args?: Record<string, unknown>) {
  if (typeof args?.chunkId === "string") {
    return {
      chunkId: args.chunkId,
    };
  }

  return partyScopedWhere(args);
}
