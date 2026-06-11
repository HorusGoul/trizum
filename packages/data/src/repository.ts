import {
  createJazzDbRepository,
  projectEntity,
  type JazzFateDb,
  type JazzFateAffectedList,
  type JazzFateEntityDefinition,
  type JazzFateListDefinition,
  type JazzFateListResult,
  type JazzFateMutationDefinition,
  type JazzFateRepository,
} from "fate-jazz";
import type { QueryOptions } from "jazz-tools";
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
      "localId",
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
    where: joinedPartyScopedWhere,
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
    affectedLists: affectedUserLists,
    proc: "user.create",
    table: trizumJazzApp.users,
    type: "User",
  },
  {
    affectedLists: affectedUserLists,
    operation: "upsert",
    proc: "user.upsert",
    table: trizumJazzApp.users,
    type: "User",
  },
  {
    affectedLists: affectedPartyLists,
    proc: "party.create",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    affectedLists: affectedPartyLists,
    operation: "upsert",
    proc: "party.upsert",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    affectedLists: affectedPartyMemberLists,
    proc: "partyMember.create",
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    affectedLists: affectedPartyMemberLists,
    operation: "upsert",
    proc: "partyMember.upsert",
    table: trizumJazzApp.partyMembers,
    type: "PartyMember",
  },
  {
    affectedLists: affectedJoinedPartyLists,
    proc: "joinedParty.create",
    table: trizumJazzApp.joinedParties,
    type: "JoinedParty",
  },
  {
    affectedLists: affectedJoinedPartyLists,
    operation: "upsert",
    proc: "joinedParty.upsert",
    table: trizumJazzApp.joinedParties,
    type: "JoinedParty",
  },
  {
    affectedLists: affectedParticipantLists,
    proc: "participant.create",
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    affectedLists: affectedParticipantLists,
    operation: "upsert",
    proc: "participant.upsert",
    table: trizumJazzApp.participants,
    type: "Participant",
  },
  {
    affectedLists: affectedMediaFileLists,
    proc: "mediaFile.create",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    affectedLists: affectedMediaFileLists,
    operation: "upsert",
    proc: "mediaFile.upsert",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    affectedLists: affectedMediaFileLists,
    operation: "delete",
    proc: "mediaFile.delete",
    table: trizumJazzApp.mediaFiles,
    type: "MediaFile",
  },
  {
    affectedLists: affectedExpenseLists,
    proc: "expense.create",
    sync: "foreground",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
  {
    affectedLists: affectedExpenseLists,
    operation: "upsert",
    proc: "expense.upsert",
    sync: "foreground",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
  {
    affectedLists: affectedExpenseLists,
    operation: "delete",
    proc: "expense.delete",
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
] as const satisfies readonly JazzFateMutationDefinition<TrizumFateEntity>[];

const columnsByType = new Map<TrizumFateTypename, readonly string[]>(
  trizumEntityDefinitions.map((definition) => [definition.type, definition.columns]),
);

export function createTrizumJazzRepository(
  db: JazzFateDb,
  options: {
    queryOptions?: QueryOptions;
    subscriptionQueryOptions?: QueryOptions;
    syncWritesToTier?: QueryOptions["tier"];
  } = {},
): TrizumDataRepository {
  return createJazzDbRepository<TrizumFateEntity, TrizumFateMutationMap>({
    db,
    entities: trizumEntityDefinitions,
    lists: trizumListDefinitions,
    mutations: trizumMutationDefinitions,
    queryOptions: options.queryOptions,
    subscriptionQueryOptions: options.subscriptionQueryOptions,
    syncWritesToTier: options.syncWritesToTier,
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

function joinedPartyScopedWhere(args?: Record<string, unknown>) {
  if (typeof args?.partyId === "string") {
    return {
      partyId: args.partyId,
    };
  }

  if (typeof args?.userId === "string") {
    return {
      $createdBy: args.userId,
    };
  }

  return undefined;
}

function affectedUserLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  return output.__typename === "User" ? [{ root: "users" }] : [];
}

function affectedPartyLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  return output.__typename === "Party" ? [{ root: "parties" }] : [];
}

function affectedPartyMemberLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  if (output.__typename !== "PartyMember") {
    return [];
  }

  return [
    { root: "partyMembers" },
    { args: { partyId: output.partyId }, root: "partyMembers" },
    { args: { userId: output.userId }, root: "partyMembers" },
  ];
}

function affectedJoinedPartyLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  if (output.__typename !== "JoinedParty") {
    return [];
  }

  return [
    { root: "joinedParties" },
    { args: { partyId: output.partyId }, root: "joinedParties" },
    { args: { userId: output.userId }, root: "joinedParties" },
  ];
}

function affectedParticipantLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  if (output.__typename !== "Participant") {
    return [];
  }

  return [{ root: "participants" }, { args: { partyId: output.partyId }, root: "participants" }];
}

function affectedMediaFileLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  if (output.__typename !== "MediaFile") {
    return [];
  }

  return [
    { root: "mediaFiles" },
    { args: { ownerUserId: output.ownerUserId }, root: "mediaFiles" },
    ...(output.partyId ? [{ args: { partyId: output.partyId }, root: "mediaFiles" }] : []),
  ];
}

function affectedExpenseLists({
  output,
}: {
  output: TrizumFateEntity;
}): readonly JazzFateAffectedList[] {
  if (output.__typename !== "Expense") {
    return [];
  }

  return [{ root: "expenses" }, { args: { partyId: output.partyId }, root: "expenses" }];
}
