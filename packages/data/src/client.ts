import { clientRoot, createClient, toEntityId } from "@nkzw/fate";
import {
  applyJazzFateMutationToCache,
  applyJazzFateSyncRejectionToCache,
  createJazzFateDb,
  createJazzFateTransport,
  refreshJazzFateCache,
  subscribeToJazzFateCacheUpdates,
  type CreateJazzFateDbOptions,
  type JazzFateAuth,
  type JazzFateEntity,
} from "fate-jazz";
import {
  canUseBrowserFallbackPersistence,
  createBrowserFallbackPersistentDb,
} from "./browserFallbackPersistence.js";
import { createTrizumJazzRepository, type TrizumDataRepository } from "./repository.js";
import { trizumFateMutations } from "./views.js";
import type {
  ExpenseEntity,
  JoinedPartyEntity,
  MediaFileEntity,
  ParticipantEntity,
  PartyEntity,
  PartyMemberEntity,
  UserEntity,
} from "./views.js";

export const trizumFateRoots = {
  user: clientRoot<UserEntity, "User">("User"),
  users: clientRoot<UserEntity, "User">("User"),
  party: clientRoot<PartyEntity, "Party">("Party"),
  parties: clientRoot<PartyEntity, "Party">("Party"),
  partyMember: clientRoot<PartyMemberEntity, "PartyMember">("PartyMember"),
  partyMembers: clientRoot<PartyMemberEntity, "PartyMember">("PartyMember"),
  joinedParty: clientRoot<JoinedPartyEntity, "JoinedParty">("JoinedParty"),
  joinedParties: clientRoot<JoinedPartyEntity, "JoinedParty">("JoinedParty"),
  participant: clientRoot<ParticipantEntity, "Participant">("Participant"),
  participants: clientRoot<ParticipantEntity, "Participant">("Participant"),
  mediaFile: clientRoot<MediaFileEntity, "MediaFile">("MediaFile"),
  mediaFiles: clientRoot<MediaFileEntity, "MediaFile">("MediaFile"),
  expense: clientRoot<ExpenseEntity, "Expense">("Expense"),
  expenses: clientRoot<ExpenseEntity, "Expense">("Expense"),
};

export type TrizumFateClient = ReturnType<typeof createTrizumFateClient>;

export type CreateTrizumFateClientOptions = {
  repository: TrizumDataRepository;
};

const pendingSyncByClient = new WeakMap<object, Set<Promise<unknown>>>();

export function createTrizumFateClient({ repository }: CreateTrizumFateClientOptions) {
  let client: ReturnType<typeof createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>>;

  const transport = createJazzFateTransport(repository, {
    async onLiveData({ affectedLists }) {
      await refreshJazzFateCache(client, affectedLists);
    },
    onMutation(event) {
      applyJazzFateMutationToCache(client, event);
    },
    resolveFetchedEntity(entity) {
      return preferFreshCachedEntity(client, entity);
    },
    onSyncPending(event) {
      trackTrizumFateSync(client, event.promise);
    },
    onSyncRejected(event) {
      applyJazzFateSyncRejectionToCache(client, event);
    },
  });

  client = createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>({
    mutations: trizumFateMutations,
    roots: trizumFateRoots,
    transport,
    types: [
      { type: "User" },
      { type: "Party" },
      { type: "PartyMember" },
      { type: "JoinedParty" },
      { type: "Participant" },
      { type: "MediaFile" },
      { type: "Expense" },
    ],
  });

  return client;
}

export type CreateLocalFirstTrizumDataClientOptions = Omit<CreateJazzFateDbOptions, "appId"> & {
  appId?: string;
};

export async function createLocalFirstTrizumDataClient(
  options: CreateLocalFirstTrizumDataClientOptions = {},
) {
  const appId = options.appId ?? "trizum-jazz-fate-poc";
  const db = await createJazzFateDb({
    appId,
    auth: options.auth,
    dbName: options.dbName,
    disableBrowserWorker: options.disableBrowserWorker,
    driver: options.driver,
    env: options.env,
    serverUrl: options.serverUrl,
    userBranch: options.userBranch,
  });
  const userId = getAuthenticatedUserId(db.getAuthState());
  const repositoryDb = await createRepositoryDb(db, {
    appId,
    dbName: options.dbName,
    disableBrowserWorker: options.disableBrowserWorker,
    driver: options.driver,
  });
  const hasRemoteSync = Boolean(options.serverUrl);
  const localQueryOptions = {
    localUpdates: "immediate" as const,
    tier: "local" as const,
  };
  const remoteLiveQueryOptions = hasRemoteSync
    ? {
        localUpdates: "immediate" as const,
        tier: "edge" as const,
      }
    : undefined;
  const remoteSettledQueryOptions = hasRemoteSync
    ? {
        localUpdates: "immediate" as const,
        tier: "edge" as const,
      }
    : undefined;
  const repository = createTrizumJazzRepository(repositoryDb, {
    queryOptions: localQueryOptions,
    subscriptionQueryOptions: remoteLiveQueryOptions,
    syncWritesToTier: hasRemoteSync ? "edge" : undefined,
  });
  const settledRepository = createTrizumJazzRepository(repositoryDb, {
    queryOptions: remoteSettledQueryOptions,
  });

  await ensureLocalFirstUser(repository, userId);

  return {
    client: createTrizumFateClient({ repository }),
    db,
    hasRemoteSync,
    settledClient: createTrizumFateClient({ repository: settledRepository }),
    userId,
  };
}

export type { JazzFateAuth };
export { refreshJazzFateCache, subscribeToJazzFateCacheUpdates };

export async function waitForTrizumFateSync(client: TrizumFateClient) {
  while (true) {
    const pendingSyncs = pendingSyncByClient.get(client);

    if (!pendingSyncs || pendingSyncs.size === 0) {
      return;
    }

    await Promise.all([...pendingSyncs]);
  }
}

function trackTrizumFateSync(client: TrizumFateClient, promise: Promise<unknown>) {
  let pendingSyncs = pendingSyncByClient.get(client);

  if (!pendingSyncs) {
    pendingSyncs = new Set();
    pendingSyncByClient.set(client, pendingSyncs);
  }

  const tracked = promise.finally(() => {
    pendingSyncs?.delete(tracked);
  });

  pendingSyncs.add(tracked);
  void tracked.catch(() => undefined);
}

type FateCacheReadableClient = {
  store?: {
    read?: (id: string) => Record<string, unknown> | undefined;
  };
};

function preferFreshCachedEntity(client: object, entity: JazzFateEntity): JazzFateEntity {
  if (entity.__typename !== "Expense") {
    return entity;
  }

  const cached = (client as FateCacheReadableClient).store?.read?.(
    toEntityId(entity.__typename, entity.id),
  );

  if (!cached || cached.__typename !== "Expense") {
    return entity;
  }

  const cachedUpdatedAt = toTimestampMs(cached.updatedAt);
  const fetchedUpdatedAt = toTimestampMs((entity as Record<string, unknown>).updatedAt);

  if (cachedUpdatedAt !== undefined) {
    if (fetchedUpdatedAt !== undefined && fetchedUpdatedAt >= cachedUpdatedAt) {
      return entity;
    }

    return mergeCachedEntity(entity, cached);
  }

  if (fetchedUpdatedAt !== undefined) {
    return entity;
  }

  if (!hasDifferentKnownHash(cached, entity)) {
    return entity;
  }

  // Legacy or locally stale Jazz rows may not have updatedAt. If the row is
  // unversioned and its content hash differs, keep the current local-first cache
  // instead of letting a revalidation downgrade a live view.
  return mergeCachedEntity(entity, cached);
}

function mergeCachedEntity(
  entity: JazzFateEntity,
  cached: Record<string, unknown>,
): JazzFateEntity {
  return {
    ...entity,
    ...cached,
    __typename: entity.__typename,
    id: entity.id,
  };
}

function hasDifferentKnownHash(cached: Record<string, unknown>, entity: JazzFateEntity): boolean {
  const cachedHash = getKnownHash(cached.hash);
  const fetchedHash = getKnownHash((entity as Record<string, unknown>).hash);

  return cachedHash !== undefined && fetchedHash !== undefined && cachedHash !== fetchedHash;
}

function getKnownHash(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const time = Date.parse(value);

    return Number.isFinite(time) ? time : undefined;
  }

  return undefined;
}

function getAuthenticatedUserId(authState: {
  session: {
    user_id: string;
  } | null;
}) {
  const userId = authState.session?.user_id;

  if (!userId) {
    throw new Error("Trizum data client requires an authenticated Jazz user session");
  }

  return userId;
}

async function ensureLocalFirstUser(repository: TrizumDataRepository, userId: string) {
  const [user] = await repository.fetchEntities("User", [userId], ["id"]);

  if (user) {
    return;
  }

  await repository.mutate?.(
    "user.upsert",
    {
      authMode: "localFirst",
      autoOpenCalculator: false,
      id: userId,
      openLastPartyOnLaunch: false,
    },
    ["id", "authMode", "autoOpenCalculator", "openLastPartyOnLaunch"],
  );
}

async function createRepositoryDb(
  db: Awaited<ReturnType<typeof createJazzFateDb>>,
  options: Pick<
    CreateLocalFirstTrizumDataClientOptions,
    "dbName" | "disableBrowserWorker" | "driver"
  > & {
    appId: string;
  },
) {
  if (
    options.disableBrowserWorker !== true ||
    options.driver?.type === "memory" ||
    !canUseBrowserFallbackPersistence()
  ) {
    return db;
  }

  return createBrowserFallbackPersistentDb({
    db,
    namespace: getBrowserFallbackNamespace(options),
  });
}

function getBrowserFallbackNamespace({
  appId,
  dbName,
  driver,
}: Pick<CreateLocalFirstTrizumDataClientOptions, "dbName" | "driver"> & {
  appId: string;
}) {
  return driver?.type === "persistent" ? (driver.dbName ?? dbName ?? appId) : (dbName ?? appId);
}
