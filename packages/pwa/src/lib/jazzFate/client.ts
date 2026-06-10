import { clientRoot, createClient } from "@nkzw/fate";
import {
  BrowserAuthSecretStore,
  createDb,
  type AuthSecretStore,
  type DbConfig,
  type Session,
} from "jazz-tools";
import { createJazzDbRepository, type JazzFateRepository } from "./repository";
import { createJazzFateTransport } from "./transport";
import { trizumFateMutations } from "./views";
import type { ExpenseEntity, ParticipantEntity, PartyEntity } from "./views";

export const trizumFateRoots = {
  party: clientRoot<PartyEntity, "Party">("Party"),
  parties: clientRoot<PartyEntity, "Party">("Party"),
  participants: clientRoot<ParticipantEntity, "Participant">("Participant"),
  expenses: clientRoot<ExpenseEntity, "Expense">("Expense"),
};

export type TrizumFateClient = ReturnType<typeof createTrizumFateClient>;

export type CreateTrizumFateClientOptions = {
  repository: JazzFateRepository;
};

export function createTrizumFateClient({ repository }: CreateTrizumFateClientOptions) {
  return createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>({
    mutations: trizumFateMutations,
    roots: trizumFateRoots,
    transport: createJazzFateTransport(repository),
    types: [{ type: "Party" }, { type: "Participant" }, { type: "Expense" }],
  });
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

export type CreateLocalFirstJazzFateClientOptions = {
  appId?: string;
  auth?: JazzFateAuth;
  dbName?: string;
  driver?: DbConfig["driver"];
  env?: string;
  serverUrl?: string;
  userBranch?: string;
};

export async function createLocalFirstJazzFateClient(
  options: CreateLocalFirstJazzFateClientOptions = {},
) {
  const appId = options.appId ?? "trizum-jazz-fate-poc";
  const auth = await resolveJazzFateAuthConfig(appId, options.auth);
  const db = await createDb({
    appId,
    dbName: options.dbName,
    driver: options.driver,
    env: options.env,
    serverUrl: options.serverUrl,
    userBranch: options.userBranch,
    ...auth,
  });

  return {
    client: createTrizumFateClient({
      repository: createJazzDbRepository(db),
    }),
    db,
  };
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

function assertNever(value: never): never {
  throw new Error(`Unhandled Jazz Fate auth mode: ${JSON.stringify(value)}`);
}
