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

export type JazzFateMutationOperation = "delete" | "insert" | "update" | "upsert";

export type JazzFateAffectedList = {
  args?: Record<string, unknown>;
  root: string;
};

export type JazzFateMutationEvent<
  TMutationMap extends JazzFateMutationMap = JazzFateMutationMap,
  TProc extends Extract<keyof TMutationMap, string> = Extract<keyof TMutationMap, string>,
> = {
  affectedLists: readonly JazzFateAffectedList[];
  input: TMutationMap[TProc]["input"];
  operation: JazzFateMutationOperation;
  output: TMutationMap[TProc]["output"];
  proc: TProc;
};

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
  getAffectedLists?<K extends Extract<keyof TMutationMap, string>>(
    proc: K,
    input: TMutationMap[K]["input"],
    output: TMutationMap[K]["output"],
  ): readonly JazzFateAffectedList[];
  getMutationOperation?<K extends Extract<keyof TMutationMap, string>>(
    proc: K,
  ): JazzFateMutationOperation;
}

export type JazzFateDb = Pick<Db, "all" | "delete" | "insert" | "one" | "update" | "upsert">;

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
  pagination?: "offset";
  root: string;
  type: TEntity["__typename"];
  where?: (args?: Record<string, unknown>) => Record<string, unknown> | undefined;
};

export type JazzFateMutationDefinition<TEntity extends JazzFateEntity = JazzFateEntity> = {
  affectedLists?: (context: { input: unknown; output: TEntity }) => readonly JazzFateAffectedList[];
  id?: (input: unknown) => string | number | undefined;
  operation?: JazzFateMutationOperation;
  proc: string;
  table: unknown;
  type: TEntity["__typename"];
};

export type CreateJazzFateTransportOptions<TMutationMap extends JazzFateMutationMap> = {
  onMutation?: <K extends Extract<keyof TMutationMap, string>>(
    event: JazzFateMutationEvent<TMutationMap, K>,
  ) => Promise<void> | void;
};

export type JazzFateCacheUpdateEvent = {
  affectedLists: readonly JazzFateAffectedList[];
};

type JazzFateCacheUpdateListener = (event: JazzFateCacheUpdateEvent) => void;

type FateRequestHandle = PromiseLike<unknown> & {
  descriptor?: {
    items?: Array<{
      argsPayload?: Record<string, unknown>;
      kind?: string;
      listKey?: string;
      name?: string;
    }>;
  };
};

type FateRequestMap = Map<string, Map<string, FateRequestHandle>>;

type FateCacheSyncStore = {
  getListState?: (key: string) => unknown;
  restoreList?: (key: string, list: unknown) => void;
};

type FateCacheSyncTarget = {
  executeRequestHandle?: (handle: FateRequestHandle, mode: string) => void;
  requests?: FateRequestMap;
  store?: FateCacheSyncStore;
};

type JazzFateLiveViewHandlers = Parameters<NonNullable<Transport["subscribeById"]>>[4];
type JazzFateLiveConnectionHandlers = Parameters<NonNullable<Transport["subscribeConnection"]>>[5];
type JazzFateLiveViewSubscription = {
  args?: Record<string, unknown>;
  handlers: JazzFateLiveViewHandlers;
  select: readonly string[];
};
type JazzFateLiveConnectionSubscription = {
  args?: Record<string, unknown>;
  handlers: JazzFateLiveConnectionHandlers;
  procedure: string;
};
type NotifyJazzFateLiveSubscribersOptions<
  TMutationMap extends JazzFateMutationMap,
  TProc extends Extract<keyof TMutationMap, string>,
> = {
  affectedLists: readonly JazzFateAffectedList[];
  connectionSubscriptions: ReadonlySet<JazzFateLiveConnectionSubscription>;
  entitySubscriptions: ReadonlyMap<string, ReadonlySet<JazzFateLiveViewSubscription>>;
  input: TMutationMap[TProc]["input"];
  operation: JazzFateMutationOperation;
  output: TMutationMap[TProc]["output"];
  proc: TProc;
  repository: JazzFateRepository<JazzFateEntity, TMutationMap>;
};

const cacheUpdateListeners = new WeakMap<object, Set<JazzFateCacheUpdateListener>>();
const cacheRefreshQueues = new WeakMap<object, Promise<unknown>>();

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
      const pagination = getOffsetPagination(args, list.pagination);
      const selectForFetch = withOrderByColumn(select, list.orderBy?.column);
      const baseQuery = selectColumns(
        applyListDefinition(entity.table, list, args),
        entity,
        selectForFetch,
      );
      const query = list.orderBy ? baseQuery : applyOffsetPagination(baseQuery, pagination);
      const rows = await db.all(query, queryOptions);
      const sortedRows = list.orderBy ? sortRows(rows as RowLike[], list.orderBy) : rows;
      const paginatedRows = list.orderBy
        ? sortedRows.slice(pagination.offset)
        : (sortedRows as RowLike[]);
      const visibleRows =
        pagination.limit === undefined ? paginatedRows : paginatedRows.slice(0, pagination.limit);
      const hasNext = pagination.limit !== undefined && paginatedRows.length > pagination.limit;

      return {
        items: visibleRows.map((row) => {
          const node = toEntity(entity, row as RowLike, select);

          return {
            cursor: String(node.id),
            node,
          };
        }),
        pagination: {
          hasNext,
          hasPrevious: pagination.offset > 0,
          nextCursor:
            hasNext && pagination.limit !== undefined
              ? String(pagination.offset + pagination.limit)
              : undefined,
          previousCursor:
            pagination.offset > 0 && pagination.limit !== undefined
              ? String(Math.max(0, pagination.offset - pagination.limit))
              : undefined,
        },
      };
    },

    async mutate(proc, input, select) {
      const mutation = mutationByProc.get(proc);

      if (!mutation) {
        throw new Error(`Unsupported Fate mutation: ${String(proc)}`);
      }

      const entity = expectEntityDefinition(entityByType, mutation.type);
      const operation = mutation.operation ?? "insert";

      if (operation === "insert") {
        const result = insertRow(db, mutation.table, input);

        await waitForWrite(result, queryOptions);

        return toEntity(
          entity,
          result.value as RowLike,
          select,
        ) as TMutationMap[typeof proc]["output"];
      }

      const id = getMutationId(mutation, input);

      if (operation === "delete") {
        const row = await db.one(
          selectColumns(where(mutation.table, { id: String(id) }), entity, select),
          queryOptions,
        );

        if (!row) {
          throw new Error(`Fate mutation ${String(proc)} could not find row ${String(id)}`);
        }

        await deleteRow(db, mutation.table, id, queryOptions);

        return toEntity(entity, row as RowLike, select) as TMutationMap[typeof proc]["output"];
      }

      if (operation === "update") {
        await updateRow(db, mutation.table, id, input, queryOptions);
      } else {
        await upsertRow(db, mutation.table, id, input, queryOptions);
      }

      const row = await db.one(
        selectColumns(where(mutation.table, { id: String(id) }), entity, select),
        queryOptions,
      );

      if (!row) {
        throw new Error(`Fate mutation ${String(proc)} did not return row ${String(id)}`);
      }

      return toEntity(entity, row as RowLike, select) as TMutationMap[typeof proc]["output"];
    },

    getAffectedLists(proc, input, output) {
      const mutation = mutationByProc.get(proc);

      if (!mutation?.affectedLists) {
        return [];
      }

      return mutation.affectedLists({
        input,
        output: output as TEntity,
      });
    },

    getMutationOperation(proc) {
      return mutationByProc.get(proc)?.operation ?? "insert";
    },
  };
}

export function createJazzFateTransport<TMutationMap extends JazzFateMutationMap>(
  repository: JazzFateRepository<JazzFateEntity, TMutationMap>,
  options: CreateJazzFateTransportOptions<TMutationMap> = {},
): Transport<TMutationMap> {
  const entitySubscriptions = new Map<string, Set<JazzFateLiveViewSubscription>>();
  const connectionSubscriptions = new Set<JazzFateLiveConnectionSubscription>();

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

      const output = await repository.mutate(proc, input, select);
      const affectedLists = repository.getAffectedLists?.(proc, input, output) ?? [];
      const operation = repository.getMutationOperation?.(proc) ?? "insert";
      await notifyJazzFateLiveSubscribers({
        affectedLists,
        connectionSubscriptions,
        entitySubscriptions,
        input,
        operation,
        output,
        proc,
        repository,
      });
      await options.onMutation?.({
        affectedLists,
        input,
        operation,
        output,
        proc,
      });

      return output;
    },

    subscribeById(type, id, select, args, handlers) {
      const key = getEntitySubscriptionKey(type, id);
      let subscriptions = entitySubscriptions.get(key);

      if (!subscriptions) {
        subscriptions = new Set();
        entitySubscriptions.set(key, subscriptions);
      }

      const subscription = {
        args: normalizeArgs(args),
        handlers,
        select: [...select],
      } satisfies JazzFateLiveViewSubscription;
      subscriptions.add(subscription);

      return () => {
        const current = entitySubscriptions.get(key);

        if (!current) {
          return;
        }

        current.delete(subscription);

        if (current.size === 0) {
          entitySubscriptions.delete(key);
        }
      };
    },

    subscribeConnection(procedure, _type, args, _select, _selectionArgs, handlers) {
      const subscription = {
        args: normalizeArgs(args),
        handlers,
        procedure,
      } satisfies JazzFateLiveConnectionSubscription;
      connectionSubscriptions.add(subscription);

      return () => {
        connectionSubscriptions.delete(subscription);
      };
    },
  };
}

export function subscribeToJazzFateCacheUpdates(
  client: object,
  listener: JazzFateCacheUpdateListener,
) {
  let listeners = cacheUpdateListeners.get(client);

  if (!listeners) {
    listeners = new Set();
    cacheUpdateListeners.set(client, listeners);
  }

  listeners.add(listener);

  return () => {
    const current = cacheUpdateListeners.get(client);

    if (!current) {
      return;
    }

    current.delete(listener);

    if (current.size === 0) {
      cacheUpdateListeners.delete(client);
    }
  };
}

export async function refreshJazzFateCache(
  client: object,
  affectedLists: readonly JazzFateAffectedList[],
) {
  const previous = cacheRefreshQueues.get(client) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => refreshJazzFateCacheNow(client, affectedLists));
  const tail = current.catch(() => undefined);

  cacheRefreshQueues.set(client, tail);

  try {
    return await current;
  } finally {
    if (cacheRefreshQueues.get(client) === tail) {
      cacheRefreshQueues.delete(client);
    }
  }
}

async function refreshJazzFateCacheNow(
  client: object,
  affectedLists: readonly JazzFateAffectedList[],
) {
  const syncTarget = client as FateCacheSyncTarget;
  const requests = syncTarget.requests;
  const executeRequestHandle = syncTarget.executeRequestHandle?.bind(client);

  if (!requests || !executeRequestHandle) {
    emitJazzFateCacheUpdate(client, { affectedLists });
    return 0;
  }

  const handles = new Set<FateRequestHandle>();

  for (const requestModes of requests.values()) {
    for (const handle of requestModes.values()) {
      if (doesRequestMatchAffectedLists(handle, affectedLists)) {
        handles.add(handle);
      }
    }
  }

  const listSnapshots = resetAffectedListStates(syncTarget.store, handles, affectedLists);

  try {
    await Promise.all(
      [...handles].map(async (handle) => {
        executeRequestHandle(handle, "network-only");
        await handle;
      }),
    );
  } catch (error) {
    restoreListStates(syncTarget.store, listSnapshots);
    throw error;
  }

  emitJazzFateCacheUpdate(client, { affectedLists });

  return handles.size;
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
  disableBrowserWorker?: boolean;
  driver?: DbConfig["driver"];
  env?: string;
  serverUrl?: string;
  userBranch?: string;
};

export async function createJazzFateDb(options: CreateJazzFateDbOptions) {
  const auth = await resolveJazzFateAuthConfig(options.appId, options.auth);

  return createDbWithBrowserWorkerOverride(options.disableBrowserWorker === true, {
    appId: options.appId,
    dbName: options.dbName,
    driver: options.driver,
    env: options.env,
    serverUrl: options.serverUrl,
    userBranch: options.userBranch,
    ...auth,
  });
}

async function createDbWithBrowserWorkerOverride(disableBrowserWorker: boolean, config: DbConfig) {
  if (!disableBrowserWorker || typeof window === "undefined" || typeof Worker === "undefined") {
    return createDb(config);
  }

  const originalWorker = Worker;

  try {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    return await createDb(config);
  } finally {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: originalWorker,
      writable: true,
    });
  }
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

function withOrderByColumn(select: Iterable<string>, column: string | undefined) {
  if (!column) {
    return select;
  }

  return new Set([...select, column]);
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

function sortRows(rows: readonly RowLike[], order: NonNullable<JazzFateListDefinition["orderBy"]>) {
  const multiplier = order.direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const comparison = compareSortValues(left[order.column], right[order.column]);

    return comparison * multiplier;
  });
}

function compareSortValues(left: unknown, right: unknown) {
  const leftValue = toSortValue(left);
  const rightValue = toSortValue(right);

  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue < rightValue ? -1 : 1;
}

function toSortValue(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time = Date.parse(value);

    return Number.isNaN(time) ? value : time;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? "";
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  if (typeof value === "bigint" || typeof value === "boolean" || typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.name ? `[function ${value.name}]` : "[function]";
  }

  return "";
}

function limit(query: unknown, count: number): unknown {
  return (
    query as {
      limit(count: number): unknown;
    }
  ).limit(count);
}

function offset(query: unknown, count: number): unknown {
  return (
    query as {
      offset(count: number): unknown;
    }
  ).offset(count);
}

function getOffsetPagination(
  args: Record<string, unknown> | undefined,
  pagination: JazzFateListDefinition["pagination"],
) {
  if (pagination !== "offset") {
    return {
      limit: undefined,
      offset: 0,
    };
  }

  const limit = coercePositiveInteger(args?.limit ?? args?.first);
  const offsetValue = coerceNonNegativeInteger(args?.offset ?? args?.after);

  return {
    limit,
    offset: offsetValue ?? 0,
  };
}

function applyOffsetPagination(
  query: QueryBuilder<RowLike>,
  pagination: ReturnType<typeof getOffsetPagination>,
): QueryBuilder<RowLike> {
  let nextQuery: unknown = query;

  if (pagination.offset > 0) {
    nextQuery = offset(nextQuery, pagination.offset);
  }

  if (pagination.limit !== undefined) {
    nextQuery = limit(nextQuery, pagination.limit + 1);
  }

  return nextQuery as QueryBuilder<RowLike>;
}

function doesRequestMatchAffectedLists(
  handle: FateRequestHandle,
  affectedLists: readonly JazzFateAffectedList[],
) {
  if (affectedLists.length === 0) {
    return false;
  }

  return (
    handle.descriptor?.items?.some(
      (item) =>
        item.kind === "list" &&
        affectedLists.some((affectedList) =>
          doesAffectedListMatchRequestItem(affectedList, item.name, item.argsPayload),
        ),
    ) === true
  );
}

function resetAffectedListStates(
  store: FateCacheSyncStore | undefined,
  handles: ReadonlySet<FateRequestHandle>,
  affectedLists: readonly JazzFateAffectedList[],
) {
  const listSnapshots = new Map<string, unknown>();

  if (!store?.getListState || !store.restoreList) {
    return listSnapshots;
  }

  for (const handle of handles) {
    for (const item of handle.descriptor?.items ?? []) {
      if (
        item.kind !== "list" ||
        !item.listKey ||
        !affectedLists.some((affectedList) =>
          doesAffectedListMatchRequestItem(affectedList, item.name, item.argsPayload),
        ) ||
        listSnapshots.has(item.listKey)
      ) {
        continue;
      }

      listSnapshots.set(item.listKey, store.getListState(item.listKey));
      store.restoreList(item.listKey, undefined);
    }
  }

  return listSnapshots;
}

function restoreListStates(
  store: FateCacheSyncStore | undefined,
  listSnapshots: ReadonlyMap<string, unknown>,
) {
  if (!store?.restoreList) {
    return;
  }

  for (const [key, list] of listSnapshots) {
    store.restoreList(key, list);
  }
}

function doesAffectedListMatchRequestItem(
  affectedList: JazzFateAffectedList,
  root: string | undefined,
  args: Record<string, unknown> | undefined,
) {
  if (affectedList.root !== root) {
    return false;
  }

  if (!affectedList.args) {
    return true;
  }

  for (const [key, value] of Object.entries(affectedList.args)) {
    if (!Object.is(args?.[key], value)) {
      return false;
    }
  }

  return true;
}

async function notifyJazzFateLiveSubscribers<
  TMutationMap extends JazzFateMutationMap,
  TProc extends Extract<keyof TMutationMap, string>,
>({
  affectedLists,
  connectionSubscriptions,
  entitySubscriptions,
  operation,
  output,
  repository,
}: NotifyJazzFateLiveSubscribersOptions<TMutationMap, TProc>) {
  if (!isJazzFateEntity(output)) {
    return;
  }

  const entityKey = getEntitySubscriptionKey(output.__typename, output.id);
  const subscriptions = entitySubscriptions.get(entityKey);

  if (subscriptions) {
    await Promise.all(
      [...subscriptions].map(async (subscription) => {
        try {
          if (operation === "delete") {
            subscription.handlers.onDelete?.(output.id);
            return;
          }

          const [record] = await repository.fetchEntities(
            output.__typename,
            [output.id],
            subscription.select,
            subscription.args,
          );

          if (record) {
            subscription.handlers.onData(record, subscription.select);
          } else {
            subscription.handlers.onDelete?.(output.id);
          }
        } catch (error) {
          subscription.handlers.onError?.(error);
        }
      }),
    );
  }

  for (const subscription of connectionSubscriptions) {
    if (
      affectedLists.some((affectedList) =>
        doesAffectedListMatchRequestItem(affectedList, subscription.procedure, subscription.args),
      )
    ) {
      if (operation === "delete") {
        subscription.handlers.onEvent({
          id: output.id,
          nodeType: output.__typename,
          type: "deleteEdge",
        });
      } else {
        subscription.handlers.onEvent({
          type: "invalidate",
        });
      }
    }
  }
}

function isJazzFateEntity(value: unknown): value is JazzFateEntity {
  return (
    !!value &&
    typeof value === "object" &&
    "__typename" in value &&
    "id" in value &&
    typeof (value as { __typename: unknown }).__typename === "string" &&
    (typeof (value as { id: unknown }).id === "string" ||
      typeof (value as { id: unknown }).id === "number")
  );
}

function getEntitySubscriptionKey(type: string, id: string | number) {
  return `${type}:${String(id)}`;
}

function emitJazzFateCacheUpdate(client: object, event: JazzFateCacheUpdateEvent) {
  const listeners = cacheUpdateListeners.get(client);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(event);
  }
}

function coercePositiveInteger(value: unknown): number | undefined {
  const number = coerceNonNegativeInteger(value);

  if (number === undefined || number <= 0) {
    return undefined;
  }

  return number;
}

function coerceNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    return undefined;
  }

  return number;
}

function insertRow(
  db: JazzFateDb,
  table: unknown,
  input: unknown,
): { value: unknown; wait?: unknown } {
  const id = getInputId(input);

  return (
    db.insert as (
      table: unknown,
      input: unknown,
      options?: { id: string },
    ) => {
      value: unknown;
    }
  )(table, stripInputId(input), id === undefined ? undefined : { id: String(id) });
}

async function updateRow(
  db: JazzFateDb,
  table: unknown,
  id: string | number,
  input: unknown,
  queryOptions: QueryOptions,
): Promise<void> {
  const result = (
    db.update as (
      table: unknown,
      id: string,
      input: unknown,
    ) => {
      wait?: unknown;
    }
  )(table, String(id), stripInputId(input));

  await waitForWrite(result, queryOptions);
}

async function upsertRow(
  db: JazzFateDb,
  table: unknown,
  id: string | number,
  input: unknown,
  queryOptions: QueryOptions,
): Promise<void> {
  const result = (
    db.upsert as (
      table: unknown,
      input: unknown,
      options: {
        id: string;
      },
    ) => {
      wait?: unknown;
    }
  )(table, stripInputId(input), { id: String(id) });

  await waitForWrite(result, queryOptions);
}

async function deleteRow(
  db: JazzFateDb,
  table: unknown,
  id: string | number,
  queryOptions: QueryOptions,
): Promise<void> {
  const result = (
    db.delete as (
      table: unknown,
      id: string,
    ) => {
      wait?: unknown;
    }
  )(table, String(id));

  await waitForWrite(result, queryOptions);
}

function getMutationId<TEntity extends JazzFateEntity>(
  definition: JazzFateMutationDefinition<TEntity>,
  input: unknown,
): string | number {
  const id = definition.id?.(input) ?? getInputId(input);

  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error(`Fate mutation ${definition.proc} requires a string or number id`);
  }

  return id;
}

function getInputId(input: unknown): string | number | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const id = (input as { id?: unknown }).id;

  return typeof id === "string" || typeof id === "number" ? id : undefined;
}

function stripInputId(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input) || !("id" in input)) {
    return input;
  }

  const { id: _id, ...withoutId } = input as Record<string, unknown>;

  return withoutId;
}

async function waitForWrite(result: { wait?: unknown }, queryOptions: QueryOptions) {
  if (typeof result.wait !== "function") {
    return;
  }

  await (result.wait as (options: Pick<QueryOptions, "tier">) => Promise<unknown>)({
    tier: queryOptions.tier,
  });
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
