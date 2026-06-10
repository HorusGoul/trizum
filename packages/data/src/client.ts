import { clientRoot, createClient } from "@nkzw/fate";
import {
  createJazzFateDb,
  createJazzFateTransport,
  type CreateJazzFateDbOptions,
  type JazzFateAuth,
} from "fate-jazz";
import { createTrizumJazzRepository, type TrizumDataRepository } from "./repository.js";
import { trizumFateMutations } from "./views.js";
import type { ExpenseEntity, ParticipantEntity, PartyEntity } from "./views.js";

export const trizumFateRoots = {
  party: clientRoot<PartyEntity, "Party">("Party"),
  parties: clientRoot<PartyEntity, "Party">("Party"),
  participants: clientRoot<ParticipantEntity, "Participant">("Participant"),
  expenses: clientRoot<ExpenseEntity, "Expense">("Expense"),
};

export type TrizumFateClient = ReturnType<typeof createTrizumFateClient>;

export type CreateTrizumFateClientOptions = {
  repository: TrizumDataRepository;
};

export function createTrizumFateClient({ repository }: CreateTrizumFateClientOptions) {
  return createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>({
    mutations: trizumFateMutations,
    roots: trizumFateRoots,
    transport: createJazzFateTransport(repository),
    types: [{ type: "Party" }, { type: "Participant" }, { type: "Expense" }],
  });
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
    driver: options.driver,
    env: options.env,
    serverUrl: options.serverUrl,
    userBranch: options.userBranch,
  });

  return {
    client: createTrizumFateClient({
      repository: createTrizumJazzRepository(db),
    }),
    db,
  };
}

export type { JazzFateAuth };
