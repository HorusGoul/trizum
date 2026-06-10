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
  return createClient<[typeof trizumFateRoots, typeof trizumFateMutations]>({
    mutations: trizumFateMutations,
    roots: trizumFateRoots,
    transport: createJazzFateTransport(repository),
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
  const userId = getAuthenticatedUserId(db.getAuthState());

  return {
    client: createTrizumFateClient({
      repository: createTrizumJazzRepository(db),
    }),
    db,
    userId,
  };
}

export type { JazzFateAuth };

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
