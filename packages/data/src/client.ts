import { clientRoot, createClient } from "@nkzw/fate";
import {
  createJazzFateDb,
  createJazzFateTransport,
  type CreateJazzFateDbOptions,
  type JazzFateAuth,
} from "fate-jazz";
import { createTrizumJazzRepository, type TrizumDataRepository } from "./repository.js";
import { trizumFateMutations } from "./views.js";
import type {
  ExpenseChunkBalancesEntity,
  ExpenseChunkEntity,
  ExpenseEntity,
  MediaFileEntity,
  ParticipantEntity,
  PartyEntity,
  PartyMemberEntity,
  UserEntity,
  UserPartyStateEntity,
} from "./views.js";

export const trizumFateRoots = {
  user: clientRoot<UserEntity, "User">("User"),
  users: clientRoot<UserEntity, "User">("User"),
  party: clientRoot<PartyEntity, "Party">("Party"),
  parties: clientRoot<PartyEntity, "Party">("Party"),
  partyMember: clientRoot<PartyMemberEntity, "PartyMember">("PartyMember"),
  partyMembers: clientRoot<PartyMemberEntity, "PartyMember">("PartyMember"),
  userPartyState: clientRoot<UserPartyStateEntity, "UserPartyState">("UserPartyState"),
  userPartyStates: clientRoot<UserPartyStateEntity, "UserPartyState">("UserPartyState"),
  participant: clientRoot<ParticipantEntity, "Participant">("Participant"),
  participants: clientRoot<ParticipantEntity, "Participant">("Participant"),
  mediaFile: clientRoot<MediaFileEntity, "MediaFile">("MediaFile"),
  mediaFiles: clientRoot<MediaFileEntity, "MediaFile">("MediaFile"),
  expenseChunk: clientRoot<ExpenseChunkEntity, "ExpenseChunk">("ExpenseChunk"),
  expenseChunks: clientRoot<ExpenseChunkEntity, "ExpenseChunk">("ExpenseChunk"),
  expenseChunkBalance: clientRoot<ExpenseChunkBalancesEntity, "ExpenseChunkBalances">(
    "ExpenseChunkBalances",
  ),
  expenseChunkBalances: clientRoot<ExpenseChunkBalancesEntity, "ExpenseChunkBalances">(
    "ExpenseChunkBalances",
  ),
  expense: clientRoot<ExpenseEntity, "Expense">("Expense"),
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
    types: [
      { type: "User" },
      { type: "Party" },
      { type: "PartyMember" },
      { type: "UserPartyState" },
      { type: "Participant" },
      { type: "MediaFile" },
      { type: "ExpenseChunk" },
      { type: "ExpenseChunkBalances" },
      { type: "Expense" },
    ],
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
