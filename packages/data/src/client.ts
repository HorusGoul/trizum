import { clientRoot, createClient } from "@nkzw/fate";
import {
  createJazzFateDb,
  createJazzFateTransport,
  refreshJazzFateCache,
  subscribeToJazzFateCacheUpdates,
  type CreateJazzFateDbOptions,
  type JazzFateAuth,
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

export function createTrizumFateClient({ repository }: CreateTrizumFateClientOptions) {
  let client: ReturnType<typeof createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>>;

  const transport = createJazzFateTransport(repository, {
    async onLiveData() {
      await refreshJazzFateCache(client, []);
    },
    async onMutation({ affectedLists }) {
      await refreshJazzFateCache(client, affectedLists);
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
  const remoteLiveQueryOptions = hasRemoteSync
    ? {
        localUpdates: "immediate" as const,
        tier: "edge" as const,
      }
    : undefined;
  const repository = createTrizumJazzRepository(repositoryDb, {
    subscriptionQueryOptions: remoteLiveQueryOptions,
  });
  const settledRepository = createTrizumJazzRepository(repositoryDb, {
    queryOptions: remoteLiveQueryOptions,
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
