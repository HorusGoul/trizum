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
  CreateParticipantMutationInput,
  CreatePartyMutationInput,
  ExpenseEntity,
  ParticipantEntity,
  PartyEntity,
  TrizumFateEntity,
  TrizumFateTypename,
} from "./views.js";

export type TrizumFateListRoot = "parties" | "participants" | "expenses";

export type TrizumFateMutationMap = {
  "party.create": {
    input: CreatePartyMutationInput;
    output: PartyEntity;
  };
  "participant.create": {
    input: CreateParticipantMutationInput;
    output: ParticipantEntity;
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
    columns: ["id", "partyId", "name", "phone", "avatarId", "isArchived", "personalMode"],
    table: trizumJazzApp.participants,
    type: "Participant",
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
    ],
    table: trizumJazzApp.expenses,
    type: "Expense",
  },
] as const satisfies readonly JazzFateEntityDefinition<TrizumFateEntity>[];

export const trizumListDefinitions = [
  {
    root: "parties",
    type: "Party",
  },
  {
    root: "participants",
    type: "Participant",
    where: partyScopedWhere,
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
    proc: "party.create",
    table: trizumJazzApp.parties,
    type: "Party",
  },
  {
    proc: "participant.create",
    table: trizumJazzApp.participants,
    type: "Participant",
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
