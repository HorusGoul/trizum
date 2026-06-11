import {
  attachJazzFateBackgroundSync,
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
  CreatePartyWithParticipantsMutationInput,
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
  "party.createWithParticipants": {
    input: CreatePartyWithParticipantsMutationInput;
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

type JazzFateGroupedWriteDb = JazzFateDb & {
  batch?<T>(
    callback: (batch: {
      insert(table: unknown, data: unknown, options?: { id?: string }): unknown;
      upsert(table: unknown, data: unknown, options: { id: string }): void;
    }) => T,
  ): {
    value: T;
    wait?: unknown;
  };
  transaction?<T>(
    callback: (transaction: {
      insert(table: unknown, data: unknown, options?: { id?: string }): unknown;
      upsert(table: unknown, data: unknown, options: { id: string }): void;
    }) => T,
  ): {
    value: T;
    wait?: unknown;
  };
};

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
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
  {
    affectedLists: affectedExpenseLists,
    operation: "upsert",
    proc: "expense.upsert",
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
    defaultMutationSync?: JazzFateMutationDefinition<TrizumFateEntity>["sync"];
    queryOptions?: QueryOptions;
    subscriptionQueryOptions?: QueryOptions;
    syncWritesToTier?: QueryOptions["tier"];
  } = {},
): TrizumDataRepository {
  const baseRepository = createJazzDbRepository<TrizumFateEntity, TrizumFateMutationMap>({
    db,
    defaultMutationSync: options.defaultMutationSync,
    entities: trizumEntityDefinitions,
    lists: trizumListDefinitions,
    mutations: trizumMutationDefinitions,
    queryOptions: options.queryOptions,
    subscriptionQueryOptions: options.subscriptionQueryOptions,
    syncWritesToTier: options.syncWritesToTier,
  });

  return {
    ...baseRepository,

    async mutate(proc, input, select) {
      if (proc === "party.createWithParticipants") {
        return (await createPartyWithParticipants(
          db,
          input as CreatePartyWithParticipantsMutationInput,
          select,
          options.syncWritesToTier,
        )) as TrizumFateMutationMap[typeof proc]["output"];
      }

      if (!baseRepository.mutate) {
        throw new Error(`Unsupported Fate mutation: ${String(proc)}`);
      }

      return baseRepository.mutate(proc, input, select);
    },

    getAffectedLists(proc, input, output) {
      if (proc === "party.createWithParticipants") {
        return [
          ...affectedPartyLists({ output }),
          {
            args: { partyId: (output as PartyEntity).id },
            root: "participants",
          },
        ];
      }

      return baseRepository.getAffectedLists?.(proc, input, output) ?? [];
    },

    getMutationOperation(proc) {
      if (proc === "party.createWithParticipants") {
        return "insert";
      }

      return baseRepository.getMutationOperation?.(proc) ?? "insert";
    },
  };
}

async function createPartyWithParticipants(
  db: JazzFateDb,
  input: CreatePartyWithParticipantsMutationInput,
  select: Iterable<string>,
  syncWritesToTier: QueryOptions["tier"],
) {
  const party = toPartyEntity(input.party);
  const groupedWriteDb = db as JazzFateGroupedWriteDb;

  if (!groupedWriteDb.transaction && !groupedWriteDb.batch) {
    throw new Error("party.createWithParticipants requires Jazz grouped write support");
  }

  const write = (scope: {
    insert(table: unknown, data: unknown, options?: { id?: string }): unknown;
  }) => {
    scope.insert(trizumJazzApp.parties, withoutId(input.party), { id: input.party.id });

    for (const participant of input.participants) {
      scope.insert(trizumJazzApp.participants, withoutId(participant), { id: participant.id });
    }

    return party;
  };
  const result = groupedWriteDb.transaction
    ? groupedWriteDb.transaction(write)
    : groupedWriteDb.batch!(write);

  await waitForWriteTier(result, "local");

  const output = projectTrizumEntity(party, select);

  if (syncWritesToTier && syncWritesToTier !== "local") {
    const backgroundSync = waitForWriteTier(result, syncWritesToTier);

    void backgroundSync.catch(() => undefined);
    attachJazzFateBackgroundSync(output, backgroundSync);
  }

  return output;
}

function toPartyEntity(input: UpsertPartyMutationInput): PartyEntity {
  return {
    __typename: "Party",
    ...input,
    currency: input.currency ?? "EUR",
    description: input.description ?? "",
    localOnlyInviteSecret: input.localOnlyInviteSecret ?? null,
    symbol: input.symbol ?? null,
  };
}

function withoutId<T extends { id: string }>(input: T): Omit<T, "id"> {
  const { id: _id, ...rest } = input;

  return rest;
}

async function waitForWriteTier(result: { wait?: unknown }, tier: QueryOptions["tier"]) {
  if (typeof result.wait !== "function") {
    return;
  }

  await (result.wait as (options: Pick<QueryOptions, "tier">) => Promise<unknown>)({
    tier,
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
