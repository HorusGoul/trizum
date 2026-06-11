import { toEntityId, type Transport } from "@nkzw/fate";
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
  subscribeEntities?(
    type: TEntity["__typename"],
    ids: Array<string | number>,
    select: Iterable<string>,
    args: Record<string, unknown> | undefined,
    onChange: (records?: TEntity[]) => void,
  ): () => void;
  subscribeList?(
    root: string,
    select: Iterable<string>,
    args: Record<string, unknown> | undefined,
    onChange: (records?: TEntity[]) => void,
  ): () => void;
}

export type JazzFateDb = Pick<
  Db,
  "all" | "delete" | "insert" | "one" | "subscribeAll" | "update" | "upsert"
>;

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
  sync?: "background" | "foreground";
  table: unknown;
  type: TEntity["__typename"];
};

export type JazzFateLiveDataEvent = {
  affectedLists: readonly JazzFateAffectedList[];
};

export type CreateJazzFateTransportOptions<TMutationMap extends JazzFateMutationMap> = {
  onLiveData?: (event: JazzFateLiveDataEvent) => Promise<void> | void;
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
      type?: string;
    }>;
  };
};

type FateRequestMap = Map<string, Map<string, FateRequestHandle>>;

type FateCacheListState = {
  cursors?: Array<string | undefined>;
  ids: string[];
  liveAfterIds?: string[];
  liveBeforeIds?: string[];
  pendingAfterIds?: string[];
  pendingBeforeIds?: string[];
  [key: string]: unknown;
};

type FateCacheStore = {
  getListState(key: string): FateCacheListState | undefined;
  setList(key: string, state: FateCacheListState): void;
};

type FateCacheSyncTarget = {
  executeRequestHandle?: (handle: FateRequestHandle, mode: string) => void;
  requests?: FateRequestMap;
  store?: FateCacheStore;
  write?: (
    type: string,
    data: JazzFateEntity,
    select: ReadonlySet<string>,
    snapshots?: unknown,
    plan?: unknown,
    pathPrefix?: unknown,
    blockedMask?: unknown,
    insert?: string,
  ) => void;
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
  select: readonly string[];
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
  defaultMutationSync?: JazzFateMutationDefinition<TEntity>["sync"];
  entities: readonly JazzFateEntityDefinition<TEntity>[];
  lists: readonly JazzFateListDefinition<TEntity>[];
  mutations?: readonly JazzFateMutationDefinition<TEntity>[];
  queryOptions?: QueryOptions;
  subscriptionQueryOptions?: QueryOptions;
  syncWritesToTier?: QueryOptions["tier"];
};

type RowLike = Record<string, unknown> & { id: string };

const defaultQueryOptions = {} satisfies QueryOptions;

export function createJazzDbRepository<
  TEntity extends JazzFateEntity = JazzFateEntity,
  TMutationMap extends JazzFateMutationMap = JazzFateMutationMap,
>({
  db,
  defaultMutationSync,
  entities,
  lists,
  mutations = [],
  queryOptions = defaultQueryOptions,
  subscriptionQueryOptions = queryOptions,
  syncWritesToTier,
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

      return rows.map((row, index) =>
        row
          ? ensureEntityId(
              toEntity(entity, withRowId(row as RowLike, ids[index]), select),
              `by-id ${type}:${String(ids[index])}`,
              row as RowLike,
            )
          : null,
      );
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
          const node = ensureEntityId(
            toEntity(entity, row as RowLike, select),
            `list ${root}`,
            row as RowLike,
          );

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

        await waitForWrite(
          result,
          queryOptions,
          syncWritesToTier,
          mutation.sync ?? defaultMutationSync,
        );

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

        await deleteRow(
          db,
          mutation.table,
          id,
          queryOptions,
          syncWritesToTier,
          mutation.sync ?? defaultMutationSync,
        );

        return toEntity(entity, row as RowLike, select) as TMutationMap[typeof proc]["output"];
      }

      const writtenRow =
        operation === "update"
          ? await updateRow(
              db,
              mutation.table,
              id,
              input,
              queryOptions,
              syncWritesToTier,
              mutation.sync ?? defaultMutationSync,
            )
          : await upsertRow(
              db,
              mutation.table,
              id,
              input,
              queryOptions,
              syncWritesToTier,
              mutation.sync ?? defaultMutationSync,
            );

      if (isRowLike(writtenRow)) {
        return toEntity(
          entity,
          withRowId(writtenRow, id),
          select,
        ) as TMutationMap[typeof proc]["output"];
      }

      const row = await db.one(
        selectColumns(where(mutation.table, { id: String(id) }), entity, select),
        queryOptions,
      );

      if (!row && operation === "upsert" && isRowLike(input)) {
        return toEntity(
          entity,
          withRowId(input, id),
          select,
        ) as TMutationMap[typeof proc]["output"];
      }

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

    subscribeEntities(type, ids, select, args, onChange) {
      const entity = expectEntityDefinition(entityByType, type);
      const unsubscribes = ids.map((id) =>
        subscribeToQueryChanges(
          db,
          selectColumns(where(entity.table, { id: String(id) }), entity, select),
          subscriptionQueryOptions,
          (rows) => {
            onChange(rows.map((row) => toEntity(entity, row, select)));
          },
        ),
      );

      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
      };
    },

    subscribeList(root, select, args, onChange) {
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

      return subscribeToQueryChanges(db, query, subscriptionQueryOptions, (rows) => {
        onChange(
          rows.map((row) => ensureEntityId(toEntity(entity, row, select), `list ${root}`, row)),
        );
      });
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

      return repository.fetchEntities(type, ids, select, normalizeArgs(args)).then((records) =>
        records.map((record, index) => {
          if (record) {
            return record;
          }

          throw new Error(`fate-jazz: ${type}:${String(ids[index])} not found`);
        }),
      );
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
      const unsubscribeRemote =
        repository.subscribeEntities?.(
          type,
          [id],
          subscription.select,
          subscription.args,
          async (records) => {
            try {
              const [record] =
                records ??
                (await repository.fetchEntities(
                  type,
                  [id],
                  subscription.select,
                  subscription.args,
                ));

              if (record) {
                subscription.handlers.onData(record, subscription.select);
              } else {
                subscription.handlers.onDelete?.(id);
              }
              await options.onLiveData?.({ affectedLists: [] });
            } catch (error) {
              subscription.handlers.onError?.(error);
            }
          },
        ) ?? (() => undefined);

      return () => {
        unsubscribeRemote();

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

    subscribeConnection(procedure, _type, args, select, _selectionArgs, handlers) {
      const subscription = {
        args: normalizeArgs(args),
        handlers,
        procedure,
        select: [...select],
      } satisfies JazzFateLiveConnectionSubscription;
      connectionSubscriptions.add(subscription);
      const unsubscribeRemote =
        repository.subscribeList?.(
          procedure,
          subscription.select,
          subscription.args,
          async (records) => {
            try {
              if (records?.length) {
                for (const record of records) {
                  subscription.handlers.onEvent({
                    edge: {
                      cursor: String(record.id),
                      node: record,
                    },
                    nodeType: record.__typename,
                    type: "prependNode",
                  });
                }
              } else {
                subscription.handlers.onEvent({
                  type: "invalidate",
                });
              }
              await options.onLiveData?.({
                affectedLists: [
                  {
                    args: subscription.args,
                    root: procedure,
                  },
                ],
              });
            } catch (error) {
              subscription.handlers.onError?.(error);
            }
          },
        ) ?? (() => undefined);

      return () => {
        unsubscribeRemote();
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

export function applyJazzFateMutationToCache(
  client: object,
  event: Pick<JazzFateMutationEvent, "affectedLists" | "operation" | "output">,
) {
  if (!isJazzFateEntity(event.output)) {
    emitJazzFateCacheUpdate(client, { affectedLists: event.affectedLists });
    return 0;
  }

  const syncTarget = client as FateCacheSyncTarget;
  const requests = syncTarget.requests;
  const store = syncTarget.store;

  writeEntityToFateCache(syncTarget, event.output);

  if (!requests || !store) {
    emitJazzFateCacheUpdate(client, { affectedLists: event.affectedLists });
    return 0;
  }

  let updatedLists = 0;
  const entityId = toEntityId(event.output.__typename, event.output.id);

  for (const requestModes of requests.values()) {
    for (const handle of requestModes.values()) {
      for (const item of handle.descriptor?.items ?? []) {
        if (
          item.kind !== "list" ||
          !item.listKey ||
          item.type !== event.output.__typename ||
          !event.affectedLists.some((affectedList) =>
            doesAffectedListMatchRequestItem(affectedList, item.name, item.argsPayload),
          )
        ) {
          continue;
        }

        const current = store.getListState(item.listKey);

        if (!current && event.operation === "delete") {
          continue;
        }

        const next =
          event.operation === "delete"
            ? removeEntityFromCacheList(current!, entityId)
            : insertEntityIntoCacheList(current ?? { ids: [] }, entityId, String(event.output.id));

        if (next === current) {
          continue;
        }

        store.setList(item.listKey, next);
        updatedLists += 1;
      }
    }
  }

  emitJazzFateCacheUpdate(client, { affectedLists: event.affectedLists });

  return updatedLists;
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

  await Promise.all(
    [...handles].map(async (handle) => {
      executeRequestHandle(handle, "network-only");
      await handle;
    }),
  );

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
    if (field !== "id" && field !== "__typename") {
      projected[field] = field in entity ? entity[field] : undefined;
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

function withRowId(row: RowLike, id: string | number): RowLike {
  if (typeof row.id === "string" || typeof row.id === "number") {
    return row;
  }

  return {
    ...row,
    id: String(id),
  };
}

function ensureEntityId<TEntity extends JazzFateEntity>(
  entity: TEntity,
  source: string,
  row: RowLike,
): TEntity {
  if (typeof entity.id === "string" || typeof entity.id === "number") {
    return entity;
  }

  throw new Error(
    `fate-jazz: Missing id while reading ${source}. Row keys: ${Object.keys(row).join(", ")}`,
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

function subscribeToQueryChanges(
  db: JazzFateDb,
  query: QueryBuilder<RowLike>,
  queryOptions: QueryOptions,
  onChange: (rows: RowLike[]) => void,
) {
  return db.subscribeAll(
    query,
    (delta) => {
      onChange(delta.all as RowLike[]);
    },
    queryOptions,
  );
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

function writeEntityToFateCache(syncTarget: FateCacheSyncTarget, output: JazzFateEntity) {
  const write = syncTarget.write?.bind(syncTarget);

  if (!write) {
    return;
  }

  write(
    output.__typename,
    output,
    new Set(Object.keys(output).filter((key) => key !== "__typename")),
    undefined,
    undefined,
    null,
    null,
    "none",
  );
}

function insertEntityIntoCacheList(
  listState: FateCacheListState,
  entityId: string,
  cursor: string | undefined,
) {
  if (hasEntityInCacheList(listState, entityId)) {
    return listState;
  }

  return {
    ...listState,
    cursors: listState.cursors ? [...listState.cursors, cursor] : listState.cursors,
    ids: [...listState.ids, entityId],
  };
}

function removeEntityFromCacheList(listState: FateCacheListState, entityId: string) {
  if (!hasEntityInCacheList(listState, entityId)) {
    return listState;
  }

  const visibleIndex = listState.ids.indexOf(entityId);

  return {
    ...listState,
    cursors:
      listState.cursors && visibleIndex >= 0
        ? listState.cursors.filter((_, index) => index !== visibleIndex)
        : listState.cursors,
    ids: removeCacheListId(listState.ids, entityId) ?? [],
    liveAfterIds: removeCacheListId(listState.liveAfterIds, entityId),
    liveBeforeIds: removeCacheListId(listState.liveBeforeIds, entityId),
    pendingAfterIds: removeCacheListId(listState.pendingAfterIds, entityId),
    pendingBeforeIds: removeCacheListId(listState.pendingBeforeIds, entityId),
  };
}

function hasEntityInCacheList(listState: FateCacheListState, entityId: string) {
  return (
    listState.ids.includes(entityId) ||
    listState.liveAfterIds?.includes(entityId) === true ||
    listState.liveBeforeIds?.includes(entityId) === true ||
    listState.pendingAfterIds?.includes(entityId) === true ||
    listState.pendingBeforeIds?.includes(entityId) === true
  );
}

function removeCacheListId(ids: string[] | undefined, entityId: string) {
  if (!ids?.includes(entityId)) {
    return ids;
  }

  return ids.filter((id) => id !== entityId);
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
          edge: {
            cursor: String(output.id),
            node: output,
          },
          nodeType: output.__typename,
          type: "prependNode",
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
  syncWritesToTier: QueryOptions["tier"],
  syncMode: JazzFateMutationDefinition["sync"],
): Promise<unknown> {
  const result = (
    db.update as (
      table: unknown,
      id: string,
      input: unknown,
    ) => {
      value?: unknown;
      wait?: unknown;
    }
  )(table, String(id), stripInputId(input));

  await waitForWrite(result, queryOptions, syncWritesToTier, syncMode);

  return result.value;
}

async function upsertRow(
  db: JazzFateDb,
  table: unknown,
  id: string | number,
  input: unknown,
  queryOptions: QueryOptions,
  syncWritesToTier: QueryOptions["tier"],
  syncMode: JazzFateMutationDefinition["sync"],
): Promise<unknown> {
  const result = (
    db.upsert as (
      table: unknown,
      input: unknown,
      options: {
        id: string;
      },
    ) => {
      value?: unknown;
      wait?: unknown;
    }
  )(table, stripInputId(input), { id: String(id) });

  await waitForWrite(result, queryOptions, syncWritesToTier, syncMode);

  return result.value;
}

async function deleteRow(
  db: JazzFateDb,
  table: unknown,
  id: string | number,
  queryOptions: QueryOptions,
  syncWritesToTier: QueryOptions["tier"],
  syncMode: JazzFateMutationDefinition["sync"],
): Promise<void> {
  const result = (
    db.delete as (
      table: unknown,
      id: string,
    ) => {
      wait?: unknown;
    }
  )(table, String(id));

  await waitForWrite(result, queryOptions, syncWritesToTier, syncMode);
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

function isRowLike(value: unknown): value is RowLike {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function waitForWrite(
  result: { wait?: unknown },
  queryOptions: QueryOptions,
  syncWritesToTier: QueryOptions["tier"],
  syncMode: JazzFateMutationDefinition["sync"],
) {
  if (syncMode !== "foreground") {
    await waitForWriteTier(result, "local");

    if (syncWritesToTier && syncWritesToTier !== "local") {
      void waitForWriteTier(result, syncWritesToTier).catch(() => undefined);
    }

    return;
  }

  const waitTier = syncWritesToTier ?? queryOptions.tier ?? "local";

  await waitForWriteTier(result, waitTier);
}

async function waitForWriteTier(result: { wait?: unknown }, tier: QueryOptions["tier"]) {
  if (typeof result.wait !== "function") {
    return;
  }

  await (result.wait as (options: Pick<QueryOptions, "tier">) => Promise<unknown>)({
    tier,
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
