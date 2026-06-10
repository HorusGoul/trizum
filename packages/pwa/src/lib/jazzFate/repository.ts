import type { QueryBuilder, QueryOptions } from "jazz-tools";
import type { Db } from "jazz-tools";
import { trizumJazzApp } from "./schema";
import type {
  CreateExpenseMutationInput,
  CreateParticipantMutationInput,
  CreatePartyMutationInput,
  ExpenseEntity,
  ParticipantEntity,
  PartyEntity,
  TrizumFateEntity,
  TrizumFateTypename,
} from "./views";

export type TrizumFateListRoot = "parties" | "participants" | "expenses";

export type JazzFateRepositoryListResult = {
  items: Array<{
    cursor: string | undefined;
    node: TrizumFateEntity;
  }>;
  pagination: {
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
};

export interface JazzFateRepository {
  fetchEntities(
    type: TrizumFateTypename,
    ids: Array<string | number>,
    select: Iterable<string>,
    args?: Record<string, unknown>,
  ): Promise<Array<TrizumFateEntity | null>>;
  fetchList(
    root: TrizumFateListRoot,
    select: Iterable<string>,
    args?: Record<string, unknown>,
  ): Promise<JazzFateRepositoryListResult>;
  createParty(input: CreatePartyMutationInput, select: Iterable<string>): Promise<PartyEntity>;
  createParticipant(
    input: CreateParticipantMutationInput,
    select: Iterable<string>,
  ): Promise<ParticipantEntity>;
  createExpense(
    input: CreateExpenseMutationInput,
    select: Iterable<string>,
  ): Promise<ExpenseEntity>;
}

type JazzFateDb = Pick<Db, "all" | "insert" | "one">;
type RowLike = Record<string, unknown> & { id: string };

const localOnlyQueryOptions = {
  propagation: "local-only",
  tier: "local",
} satisfies QueryOptions;

const entityConfig = {
  Party: {
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
  },
  Participant: {
    columns: ["id", "partyId", "name", "phone", "avatarId", "isArchived", "personalMode"],
    table: trizumJazzApp.participants,
  },
  Expense: {
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
  },
} as const;

const listRootType = {
  parties: "Party",
  participants: "Participant",
  expenses: "Expense",
} as const satisfies Record<TrizumFateListRoot, TrizumFateTypename>;

export function createJazzDbRepository(db: JazzFateDb): JazzFateRepository {
  return {
    async fetchEntities(type, ids, select) {
      const rows = await Promise.all(
        ids.map((id) =>
          db.one(
            selectColumns(where(entityConfig[type].table, { id: String(id) }), type, select),
            localOnlyQueryOptions,
          ),
        ),
      );

      return rows.map((row) => (row ? toEntity(type, row as RowLike, select) : null));
    },

    async fetchList(root, select, args) {
      const type = listRootType[root];
      const query = selectColumns(
        applyListArgs(entityConfig[type].table, type, args),
        type,
        select,
      );
      const rows = await db.all(query, localOnlyQueryOptions);

      return {
        items: rows.map((row) => {
          const entity = toEntity(type, row as RowLike, select);

          return {
            cursor: entity.id,
            node: entity,
          };
        }),
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      };
    },

    async createParty(input, select) {
      const result = db.insert(trizumJazzApp.parties, input);
      return toEntity("Party", result.value as RowLike, select) as PartyEntity;
    },

    async createParticipant(input, select) {
      const result = db.insert(trizumJazzApp.participants, input);
      return toEntity("Participant", result.value as RowLike, select) as ParticipantEntity;
    },

    async createExpense(input, select) {
      const result = db.insert(trizumJazzApp.expenses, input);
      return toEntity("Expense", result.value as RowLike, select) as ExpenseEntity;
    },
  };
}

export function projectEntity<T extends TrizumFateEntity>(entity: T, select: Iterable<string>): T {
  const selected = selectedFieldSet(entity.__typename, select);
  const projected: Record<string, unknown> = {
    __typename: entity.__typename,
    id: entity.id,
  };

  for (const field of selected) {
    if (field in entity && field !== "id" && field !== "__typename") {
      projected[field] = entity[field as keyof T];
    }
  }

  return projected as T;
}

function toEntity(
  type: TrizumFateTypename,
  row: RowLike,
  select: Iterable<string>,
): TrizumFateEntity {
  return projectEntity(
    {
      __typename: type,
      ...row,
    } as TrizumFateEntity,
    select,
  );
}

function selectedFieldSet(type: TrizumFateTypename, select: Iterable<string>): Set<string> {
  const allowed = new Set<string>(entityConfig[type].columns);
  const selected = new Set<string>(["id"]);

  for (const field of select) {
    if (allowed.has(field)) {
      selected.add(field);
    }
  }

  return selected;
}

function selectedColumns(
  type: TrizumFateTypename,
  select: Iterable<string>,
): [string, ...string[]] {
  return [...selectedFieldSet(type, select)] as [string, ...string[]];
}

function selectColumns(
  query: unknown,
  type: TrizumFateTypename,
  select: Iterable<string>,
): QueryBuilder<RowLike> {
  const columns = selectedColumns(type, select);

  return (
    query as {
      select(...columns: [string, ...string[]]): QueryBuilder<RowLike>;
    }
  ).select(...columns);
}

function where(query: unknown, conditions: Record<string, unknown>): unknown {
  return (
    query as {
      where(conditions: Record<string, unknown>): unknown;
    }
  ).where(conditions);
}

function orderBy(query: unknown, column: string, direction: "asc" | "desc"): unknown {
  return (
    query as {
      orderBy(column: string, direction: "asc" | "desc"): unknown;
    }
  ).orderBy(column, direction);
}

function applyListArgs(
  table: unknown,
  type: TrizumFateTypename,
  args?: Record<string, unknown>,
): unknown {
  let query = table;

  if (type !== "Party" && typeof args?.partyId === "string") {
    query = where(query, { partyId: args.partyId });
  }

  if (type === "Expense") {
    query = orderBy(query, "paidAt", "desc");
  }

  return query;
}
