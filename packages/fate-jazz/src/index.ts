import type { Transport } from "@nkzw/fate";
import {
  BrowserAuthSecretStore,
  createDb,
  type AuthSecretStore,
  type Db,
  type DbConfig,
  type QueryBuilder,
  type QueryOptions,
  type Session,
} from "jazz-tools";

export type JazzFateEntity = {
  __typename: string;
  id: string | number;
  [key: string]: unknown;
};

export type JazzFatePagination = {
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
};

export type JazzFateListResult<TEntity extends JazzFateEntity = JazzFateEntity> = {
  items: Array<{
    cursor: string | undefined;
    node: TEntity;
  }>;
  pagination: JazzFatePagination;
};

export type JazzFateMutationShape = {
  input: unknown;
  output: unknown;
};

export type JazzFateMutationMap = Record<string, JazzFateMutationShape>;

export interface JazzFateRepository<
  TEntity extends JazzFateEntity = JazzFateEntity,
  TMutationMap extends JazzFateMutationMap = JazzFateMutationMap,
> {
  entityTypes: ReadonlySet<string>;
  listRoots: ReadonlySet<string>;
  fetchEntities(
    type: TEntity["__typename"],
    ids: Array<string | number>,
    select: Iterable<string>,
    args?: Record<string, unknown>,
  ): Promise<Array<TEntity | null>>;
  fetchList(
    root: string,
    select: Iterable<string>,
    args?: Record<string, unknown>,
  ): Promise<JazzFateListResult<TEntity>>;
  mutate?<K extends Extract<keyof TMutationMap, string>>(
    proc: K,
    input: TMutationMap[K]["input"],
    select: Iterable<string>,
  ): Promise<TMutationMap[K]["output"]>;
}

export type JazzFateDb = Pick<Db, "all" | "insert" | "one">;

export type JazzFateEntityDefinition<TEntity extends JazzFateEntity = JazzFateEntity> = {
  columns: readonly string[];
  table: unknown;
  type: TEntity["__typename"];
};

export type JazzFateListDefinition<TEntity extends JazzFateEntity = JazzFateEntity> = {
  orderBy?: {
    column: string;
    direction: "asc" | "desc";
  };
  root: string;
  type: TEntity["__typename"];
  where?: (args?: Record<string, unknown>) => Record<string, unknown> | undefined;
};

export type JazzFateMutationDefinition<TEntity extends JazzFateEntity = JazzFateEntity> = {
  proc: string;
  table: unknown;
  type: TEntity["__typename"];
};

export type CreateJazzDbRepositoryOptions<TEntity extends JazzFateEntity = JazzFateEntity> = {
  db: JazzFateDb;
  entities: readonly JazzFateEntityDefinition<TEntity>[];
  lists: readonly JazzFateListDefinition<TEntity>[];
  mutations?: readonly JazzFateMutationDefinition<TEntity>[];
  queryOptions?: QueryOptions;
};

type RowLike = Record<string, unknown> & { id: string };

const defaultQueryOptions = {
  propagation: "local-only",
  tier: "local",
} satisfies QueryOptions;

export function createJazzDbRepository<
  TEntity extends JazzFateEntity = JazzFateEntity,
  TMutationMap extends JazzFateMutationMap = JazzFateMutationMap,
>({
  db,
  entities,
  lists,
  mutations = [],
  queryOptions = defaultQueryOptions,
}: CreateJazzDbRepositoryOptions<TEntity>): JazzFateRepository<TEntity, TMutationMap> {
  const entityByType = new Map(entities.map((entity) => [entity.type, entity]));
  const listByRoot = new Map(lists.map((list) => [list.root, list]));
  const mutationByProc = new Map(mutations.map((mutation) => [mutation.proc, mutation]));
  const entityTypes = new Set(entityByType.keys());
  const listRoots = new Set(listByRoot.keys());

  return {
    entityTypes,
    listRoots,

    async fetchEntities(type, ids, select) {
      const entity = expectEntityDefinition(entityByType, type);
      const rows = await Promise.all(
        ids.map((id) =>
          db.one(
            selectColumns(where(entity.table, { id: String(id) }), entity, select),
            queryOptions,
          ),
        ),
      );

      return rows.map((row) => (row ? toEntity(entity, row as RowLike, select) : null));
    },

    async fetchList(root, select, args) {
      const list = expectListDefinition(listByRoot, root);
      const entity = expectEntityDefinition(entityByType, list.type);
      const query = selectColumns(applyListDefinition(entity.table, list, args), entity, select);
      const rows = await db.all(query, queryOptions);

      return {
        items: rows.map((row) => {
          const node = toEntity(entity, row as RowLike, select);

          return {
            cursor: String(node.id),
            node,
          };
        }),
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      };
    },

    async mutate(proc, input, select) {
      const mutation = mutationByProc.get(proc);

      if (!mutation) {
        throw new Error(`Unsupported Fate mutation: ${String(proc)}`);
      }

      const result = insertRow(db, mutation.table, input);
      const entity = expectEntityDefinition(entityByType, mutation.type);

      return toEntity(
        entity,
        result.value as RowLike,
        select,
      ) as TMutationMap[typeof proc]["output"];
    },
  };
}

export function createJazzFateTransport<TMutationMap extends JazzFateMutationMap>(
  repository: JazzFateRepository<JazzFateEntity, TMutationMap>,
): Transport<TMutationMap> {
  return {
    fetchById(type, ids, select, args) {
      if (!repository.entityTypes.has(type)) {
        throw new Error(`Unsupported Fate entity type: ${type}`);
      }

      return repository.fetchEntities(type, ids, select, normalizeArgs(args));
    },

    fetchList(root, select, args) {
      if (!repository.listRoots.has(root)) {
        throw new Error(`Unsupported Fate list root: ${root}`);
      }

      return repository.fetchList(root, select, normalizeArgs(args));
    },

    async mutate(proc, input, select) {
      if (!repository.mutate) {
        throw new Error(`Unsupported Fate mutation: ${String(proc)}`);
      }

      return repository.mutate(proc, input, select);
    },
  };
}

export function projectEntity<TEntity extends JazzFateEntity>(
  entity: TEntity,
  select: Iterable<string>,
  columns: readonly string[],
): TEntity {
  const selected = selectedFieldSet(select, columns);
  const projected: Record<string, unknown> = {
    __typename: entity.__typename,
    id: entity.id,
  };

  for (const field of selected) {
    if (field in entity && field !== "id" && field !== "__typename") {
      projected[field] = entity[field];
    }
  }

  return projected as TEntity;
}

export type LocalFirstUserAuth = {
  mode?: "localFirstUser";
  secret?: string;
  secretStore?: AuthSecretStore;
};

export type ExternalAccountAuth = {
  jwtToken: string;
  mode: "externalAccount";
};

export type CookieAccountAuth = {
  cookieSession: Session;
  mode: "cookieAccount";
};

export type AnonymousGuestAuth = {
  mode: "anonymousGuest";
};

export type JazzFateAuth =
  | AnonymousGuestAuth
  | CookieAccountAuth
  | ExternalAccountAuth
  | LocalFirstUserAuth;

export type CreateJazzFateDbOptions = {
  appId: string;
  auth?: JazzFateAuth;
  dbName?: string;
  driver?: DbConfig["driver"];
  env?: string;
  serverUrl?: string;
  userBranch?: string;
};

export async function createJazzFateDb(options: CreateJazzFateDbOptions) {
  const auth = await resolveJazzFateAuthConfig(options.appId, options.auth);

  return createDb({
    appId: options.appId,
    dbName: options.dbName,
    driver: options.driver,
    env: options.env,
    serverUrl: options.serverUrl,
    userBranch: options.userBranch,
    ...auth,
  });
}

export async function resolveJazzFateAuthConfig(
  appId: string,
  auth: JazzFateAuth = {},
): Promise<Pick<DbConfig, "cookieSession" | "jwtToken" | "secret">> {
  switch (auth.mode) {
    case "externalAccount":
      return { jwtToken: auth.jwtToken };
    case "cookieAccount":
      return { cookieSession: auth.cookieSession };
    case "anonymousGuest":
      return {};
    case "localFirstUser":
    case undefined: {
      const secret =
        auth.secret ??
        (await (
          auth.secretStore ?? BrowserAuthSecretStore.getDefault({ appId })
        ).getOrCreateSecret());

      return { secret };
    }
    default:
      assertNever(auth);
  }
}

function toEntity<TEntity extends JazzFateEntity>(
  definition: JazzFateEntityDefinition<TEntity>,
  row: RowLike,
  select: Iterable<string>,
): TEntity {
  return projectEntity(
    {
      __typename: definition.type,
      ...row,
    } as TEntity,
    select,
    definition.columns,
  );
}

function selectedFieldSet(select: Iterable<string>, columns: readonly string[]): Set<string> {
  const allowed = new Set<string>(columns);
  const selected = new Set<string>(["id"]);

  for (const field of select) {
    if (allowed.has(field)) {
      selected.add(field);
    }
  }

  return selected;
}

function selectedColumns<TEntity extends JazzFateEntity>(
  definition: JazzFateEntityDefinition<TEntity>,
  select: Iterable<string>,
): [string, ...string[]] {
  return [...selectedFieldSet(select, definition.columns)] as [string, ...string[]];
}

function selectColumns<TEntity extends JazzFateEntity>(
  query: unknown,
  definition: JazzFateEntityDefinition<TEntity>,
  select: Iterable<string>,
): QueryBuilder<RowLike> {
  const columns = selectedColumns(definition, select);

  return (
    query as {
      select(...columns: [string, ...string[]]): QueryBuilder<RowLike>;
    }
  ).select(...columns);
}

function applyListDefinition<TEntity extends JazzFateEntity>(
  table: unknown,
  definition: JazzFateListDefinition<TEntity>,
  args?: Record<string, unknown>,
): unknown {
  let query = table;
  const conditions = definition.where?.(args);

  if (conditions) {
    query = where(query, conditions);
  }

  if (definition.orderBy) {
    query = orderBy(query, definition.orderBy.column, definition.orderBy.direction);
  }

  return query;
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

function insertRow(db: JazzFateDb, table: unknown, input: unknown): { value: unknown } {
  return (
    db.insert as (
      table: unknown,
      input: unknown,
    ) => {
      value: unknown;
    }
  )(table, input);
}

function normalizeArgs(args: unknown): Record<string, unknown> | undefined {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }

  return undefined;
}

function expectEntityDefinition<TEntity extends JazzFateEntity>(
  entities: ReadonlyMap<string, JazzFateEntityDefinition<TEntity>>,
  type: string,
) {
  const entity = entities.get(type);

  if (!entity) {
    throw new Error(`Unsupported Fate entity type: ${type}`);
  }

  return entity;
}

function expectListDefinition<TEntity extends JazzFateEntity>(
  lists: ReadonlyMap<string, JazzFateListDefinition<TEntity>>,
  root: string,
) {
  const list = lists.get(root);

  if (!list) {
    throw new Error(`Unsupported Fate list root: ${root}`);
  }

  return list;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Jazz Fate auth mode: ${JSON.stringify(value)}`);
}
