import { PARTICIPANT_CONNECTION_VIEW } from "./trizumFateViews.ts";
import {
  ExpenseListItemView,
  JoinedPartyView,
  MediaFileBlobView,
  ParticipantView,
  PartyMemberView,
  PartySettingsView,
  ConnectionTag,
  applyJazzFateMutationToCache,
  refreshJazzFateCache,
  toEntityId,
  UserSettingsView,
  type ExpenseEntity,
  type JoinedPartyEntity,
  type MediaFileEntity,
  type ParticipantEntity,
  type PartyEntity,
  type PartyMemberEntity,
  type RequestOptions,
  type TrizumFateClient,
  type UpsertParticipantMutationInput,
  type UserEntity,
} from "@trizum/data";
import { md5 } from "@takker/md5";
import type { Currency } from "dinero.js";
import { calculateExpenseHash, getExpenseTotalAmount, type Expense } from "#src/models/expense.js";
import type { MediaFile } from "#src/models/media.js";
import type { Party, PartyParticipant } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import type { SupportedLocale } from "#src/lib/i18n.js";

export interface CreatePartyValues {
  currency: Currency;
  description: string;
  name: string;
  participants: PartyParticipant[];
  symbol?: string;
}

type JsonLike = boolean | number | string | null | JsonLike[] | { [key: string]: JsonLike };
type MutationResult<T> = {
  error?: unknown;
  result?: T;
};
type FateConnectionMetadata = {
  key: string;
};
type FateConnectionWithMetadata = {
  [ConnectionTag]?: FateConnectionMetadata;
};
type FateListState = {
  cursors?: Array<string | undefined>;
  ids: string[];
  [key: string]: unknown;
};
type FateStoreTarget = {
  store?: {
    getListState(key: string): FateListState | undefined;
    setList(key: string, state: FateListState): void;
  };
};
export type PartyEntitySnapshot = {
  participants: ParticipantEntity[];
  party: PartyEntity;
};
export type DataReadResult<T> =
  | {
      status: "empty";
      value: T;
    }
  | {
      status: "error";
      error: unknown;
    }
  | {
      status: "found";
      value: T;
    }
  | {
      status: "notFound";
    };

export async function createPartyInFate({
  client,
  userId,
  values,
}: {
  client: TrizumFateClient;
  userId: string;
  values: CreatePartyValues;
}) {
  const partyId = createPartyId();
  const localOnlyInviteSecret = createInviteSecret();
  const party: Party = {
    currency: values.currency,
    description: values.description,
    id: partyId,
    name: values.name,
    participants: Object.fromEntries(
      values.participants.map((participant) => [participant.id, participant]),
    ),
    symbol: values.symbol,
    type: "party",
  };
  const partyInput = {
    currency: party.currency,
    description: party.description,
    id: party.id,
    localOnlyInviteSecret,
    name: party.name,
    ownerUserId: userId,
    symbol: party.symbol,
  };
  const participantEntities = values.participants.map((participant) =>
    createParticipantEntity(partyId, participant),
  );
  const result = await client.mutations.party.create({
    input: partyInput,
    optimistic: {
      __typename: "Party",
      ...partyInput,
    } as PartyEntity,
    view: PartySettingsView,
  });
  const partyEntity = expectMutationResult(result, "party.create did not return a result");
  const createdParticipantEntities = await Promise.all(
    participantEntities.map(async (participantEntity) => {
      const { __typename: _typename, ...input } = participantEntity;
      const participantResult = await client.mutations.participant.create({
        input,
        optimistic: participantEntity,
        view: ParticipantView,
      });

      return expectMutationResult(participantResult, "participant.create did not return a result");
    }),
  );
  const participantListKey = await primeParticipantList(client, partyId);
  writePartyEntitiesToFateCache(client, {
    participants: createdParticipantEntities,
    party: partyEntity,
  });
  seedParticipantList(client, participantListKey, createdParticipantEntities);

  return party;
}

export async function upsertParty(
  client: TrizumFateClient,
  userId: string,
  party: Pick<Party, "currency" | "description" | "id" | "name" | "symbol"> & {
    localOnlyInviteSecret?: string;
  },
) {
  const input = {
    currency: party.currency,
    description: party.description,
    id: party.id,
    localOnlyInviteSecret: party.localOnlyInviteSecret,
    name: party.name,
    ownerUserId: userId,
    symbol: party.symbol,
  };
  const result = await client.mutations.party.upsert({
    input,
    optimistic: {
      __typename: "Party",
      ...input,
    } as PartyEntity,
    view: PartySettingsView,
  });

  return expectMutationResult(result, "party.upsert did not return a result");
}

export async function upsertParticipant(
  client: TrizumFateClient,
  partyId: string,
  participant: PartyParticipant,
) {
  const { __typename: _typename, ...input } = createParticipantEntity(partyId, participant);
  const result = await client.mutations.participant.upsert({
    input,
    optimistic: {
      __typename: "Participant",
      ...input,
    } as ParticipantEntity,
    view: ParticipantView,
  });

  return expectMutationResult(result, "participant.upsert did not return a result");
}

function createParticipantEntity(
  partyId: string,
  participant: PartyParticipant,
): ParticipantEntity & UpsertParticipantMutationInput {
  return {
    __typename: "Participant",
    avatarId: participant.avatarId ?? null,
    balancesSortedBy: participant.balancesSortedBy ?? "name",
    id: getParticipantEntityId(partyId, participant.id),
    isArchived: participant.isArchived ?? false,
    localId: participant.id,
    name: participant.name,
    partyId,
    personalMode: participant.personalMode ?? false,
    phone: participant.phone ?? null,
  };
}

export async function upsertPartyMember(
  client: TrizumFateClient,
  userId: string,
  partyId: string,
  participantId: string,
  role: "editor" | "owner" | "viewer" = "editor",
) {
  const input = {
    id: getPartyMemberId(userId, partyId),
    participantId,
    partyId,
    role,
    userId,
  };
  const created = await tryCreateMutation(() =>
    client.mutations.partyMember.create({
      input,
      optimistic: {
        __typename: "PartyMember",
        ...input,
      } as PartyMemberEntity,
      view: PartyMemberView,
    }),
  );

  if (created) {
    return created;
  }

  const result = await client.mutations.partyMember.upsert({
    input: {
      ...input,
    },
    optimistic: {
      __typename: "PartyMember",
      ...input,
    } as PartyMemberEntity,
    view: PartyMemberView,
  });

  throwMutationError(result.error);

  return result.result;
}

export async function ensurePartyMemberForSelection(
  client: TrizumFateClient,
  userId: string,
  partyId: string,
) {
  const existing = await readPartyMember(client, userId, partyId);

  if (existing) {
    return existing;
  }

  const input = {
    id: getPartyMemberId(userId, partyId),
    partyId,
    role: "editor" as const,
    userId,
  };
  const result = await client.mutations.partyMember.create({
    input,
    optimistic: {
      __typename: "PartyMember",
      ...input,
    } as PartyMemberEntity,
    view: PartyMemberView,
  });

  return expectMutationResult(result, "partyMember.create did not return a result");
}

export async function upsertJoinedParty(
  client: TrizumFateClient,
  userId: string,
  partyId: string,
  values: {
    isArchived: boolean;
    isPinned: boolean;
    joinedAt?: Date;
    lastUsedAt?: Date;
    participantId?: string;
  },
) {
  const optimistic = createJoinedPartyEntity(userId, partyId, values);
  const { __typename: _typename, ...input } = optimistic;
  const created = await tryCreateMutation(() =>
    client.mutations.joinedParty.create({
      input,
      insert: "before",
      optimistic,
      view: JoinedPartyView,
    }),
  );

  if (created) {
    return created;
  }

  const result = await client.mutations.joinedParty.upsert({
    input,
    optimistic,
    view: JoinedPartyView,
  });

  return expectMutationResult(result, "joinedParty.upsert did not return a result");
}

export function createJoinedPartyEntity(
  userId: string,
  partyId: string,
  values: {
    isArchived: boolean;
    isPinned: boolean;
    joinedAt?: Date;
    lastUsedAt?: Date;
    participantId?: string;
  },
): JoinedPartyEntity {
  return {
    __typename: "JoinedParty",
    id: getJoinedPartyId(userId, partyId),
    isArchived: values.isArchived,
    isPinned: values.isArchived ? false : values.isPinned,
    joinedAt: values.joinedAt,
    lastUsedAt: values.lastUsedAt,
    participantId: values.participantId,
    partyId,
    userId,
  } as JoinedPartyEntity;
}

export async function upsertUserSettings(
  client: TrizumFateClient,
  userId: string,
  values: Partial<
    Pick<
      PartyList,
      | "autoOpenCalculator"
      | "avatarId"
      | "hue"
      | "lastOpenedPartyId"
      | "locale"
      | "openLastPartyOnLaunch"
      | "phone"
      | "username"
    >
  >,
) {
  const current = await readUserSettings(client, userId);
  const input = {
    authMode: "localFirst" as const,
    autoOpenCalculator: values.autoOpenCalculator ?? current?.autoOpenCalculator ?? false,
    avatarId: values.avatarId ?? current?.avatarId ?? undefined,
    displayName: values.username ?? current?.displayName ?? undefined,
    hue: values.hue ?? current?.hue,
    id: userId,
    lastOpenedPartyId: values.lastOpenedPartyId ?? current?.lastOpenedPartyId ?? undefined,
    locale: values.locale ?? current?.locale,
    openLastPartyOnLaunch: values.openLastPartyOnLaunch ?? current?.openLastPartyOnLaunch ?? false,
    phone: values.phone ?? current?.phone ?? undefined,
  };
  const result = await client.mutations.user.upsert({
    input,
    optimistic: {
      __typename: "User",
      ...input,
    } as UserEntity,
    view: UserSettingsView,
  });

  return expectMutationResult(result, "user.upsert did not return a result");
}

export async function createExpenseInFate(
  client: TrizumFateClient,
  partyId: string,
  expense: Omit<Expense, "__hash" | "id">,
) {
  const expenseWithId: Expense = {
    ...expense,
    __hash: "",
    id: createExpenseId(),
  };
  expenseWithId.__hash = calculateExpenseHash(expenseWithId);

  const result = await client.mutations.expense.create({
    input: expenseToMutationInput(partyId, expenseWithId),
    insert: "before",
    optimistic: expenseToOptimisticEntity(partyId, expenseWithId),
    view: ExpenseListItemView,
  });

  return toExpense(expectMutationResult(result, "expense.create did not return a result"));
}

export async function upsertExpenseInFate(
  client: TrizumFateClient,
  partyId: string,
  expense: Expense,
) {
  const expenseWithHash: Expense = {
    ...expense,
    __hash: calculateExpenseHash(expense),
  };
  const result = await client.mutations.expense.upsert({
    input: expenseToMutationInput(partyId, expenseWithHash),
    optimistic: expenseToOptimisticEntity(partyId, expenseWithHash),
    view: ExpenseListItemView,
  });

  return toExpense(expectMutationResult(result, "expense.upsert did not return a result"));
}

export async function deleteExpenseInFate(
  client: TrizumFateClient,
  _partyId: string,
  expenseId: string,
) {
  const result = await client.mutations.expense.delete({
    delete: true,
    input: {
      id: expenseId,
    },
    view: ExpenseListItemView,
  });

  throwMutationError(result.error);

  return true;
}

export async function createMediaFileInFate(
  client: TrizumFateClient,
  userId: string,
  values: {
    encodedBlob: string;
    metadata: Record<string, unknown>;
    partyId?: string;
  },
) {
  const result = await client.mutations.mediaFile.create({
    input: {
      encodedBlob: values.encodedBlob,
      metadata: values.metadata as JsonLike,
      ownerUserId: userId,
      partyId: values.partyId,
    },
    view: MediaFileBlobView,
  });

  return toMediaFile(expectMutationResult(result, "mediaFile.create did not return a result"));
}

export async function readParty(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
): Promise<Party | undefined> {
  const result = await readPartyResult(client, partyId, options);

  return result.status === "found" ? result.value : undefined;
}

export async function waitForPartyInFate(
  client: TrizumFateClient,
  partyId: string,
  options: {
    minParticipants?: number;
    timeoutMs?: number;
  } = {},
): Promise<Party | undefined> {
  const minParticipants = options.minParticipants ?? 0;
  const retryUntil = Date.now() + (options.timeoutMs ?? 8_000);

  while (true) {
    const remainingMs = retryUntil - Date.now();

    if (remainingMs <= 0) {
      return undefined;
    }

    const result = await withTimeout(
      readPartyResult(client, partyId),
      Math.min(2_000, remainingMs),
    );

    if (!result) {
      await sleep(250);
      continue;
    }

    if (
      result.status === "found" &&
      Object.keys(result.value.participants).length >= minParticipants
    ) {
      return result.value;
    }

    if (result.status === "error") {
      throw result.error;
    }

    if (Date.now() >= retryUntil) {
      return result.status === "found" ? result.value : undefined;
    }

    await sleep(250);
  }
}

export async function waitForPartyEntitiesInFate(
  client: TrizumFateClient,
  partyId: string,
  options: {
    minParticipants?: number;
    timeoutMs?: number;
  } = {},
): Promise<PartyEntitySnapshot | undefined> {
  const minParticipants = options.minParticipants ?? 0;
  const retryUntil = Date.now() + (options.timeoutMs ?? 8_000);

  while (true) {
    const remainingMs = retryUntil - Date.now();

    if (remainingMs <= 0) {
      return undefined;
    }

    const result = await withTimeout(
      readPartyEntitiesResult(client, partyId),
      Math.min(2_000, remainingMs),
    );

    if (!result) {
      await sleep(250);
      continue;
    }

    if (result.status === "found" && result.value.participants.length >= minParticipants) {
      return result.value;
    }

    if (result.status === "error") {
      throw result.error;
    }

    if (Date.now() >= retryUntil) {
      return result.status === "found" ? result.value : undefined;
    }

    await sleep(250);
  }
}

export async function readPartyResult(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
): Promise<DataReadResult<Party>> {
  const result = await readPartyEntitiesResult(client, partyId, options);

  if (result.status === "error" || result.status === "notFound") {
    return result;
  }

  if (result.status === "empty") {
    return {
      status: "notFound",
    };
  }

  return {
    status: "found",
    value: toParty(result.value.party, result.value.participants),
  };
}

export async function readPartyList(client: TrizumFateClient, userId: string): Promise<PartyList> {
  const user = await readUserSettings(client, userId);
  const joinedParties = await readJoinedParties(client, userId);

  return toPartyList(userId, user, joinedParties);
}

export async function readExpenseById(
  client: TrizumFateClient,
  expenseId: string,
  options?: RequestOptions,
) {
  const result = await readExpenseByIdResult(client, expenseId, options);

  return result.status === "found" ? result.value : undefined;
}

export async function readExpenseByIdResult(
  client: TrizumFateClient,
  expenseId: string,
  options?: RequestOptions,
): Promise<DataReadResult<Expense>> {
  const result = await readExpenseEntityByIdResult(client, expenseId, options);

  if (result.status === "found") {
    return {
      status: "found",
      value: toExpense(result.value),
    };
  }

  if (result.status === "error") {
    return result;
  }

  return {
    status: "notFound",
  };
}

export async function readExpenseEntityByIdResult(
  client: TrizumFateClient,
  expenseId: string,
  options?: RequestOptions,
): Promise<DataReadResult<ExpenseEntity>> {
  try {
    const { expense } = await client.request(
      {
        expense: {
          id: expenseId,
          view: ExpenseListItemView,
        },
      },
      options,
    );
    const snapshot = await client.readView(ExpenseListItemView, expense);
    await notifyFateReadComplete(client);

    return {
      status: "found",
      value: snapshot.data as unknown as ExpenseEntity,
    };
  } catch (error) {
    return readErrorAsNotFound(error);
  }
}

export async function waitForExpenseEntityInFate(
  client: TrizumFateClient,
  expenseId: string,
  options: {
    timeoutMs?: number;
  } = {},
): Promise<ExpenseEntity | undefined> {
  const retryUntil = Date.now() + (options.timeoutMs ?? 8_000);

  while (true) {
    const remainingMs = retryUntil - Date.now();

    if (remainingMs <= 0) {
      return undefined;
    }

    const result = await withTimeout(
      readExpenseEntityByIdResult(client, expenseId),
      Math.min(2_000, remainingMs),
    );

    if (!result) {
      await sleep(250);
      continue;
    }

    if (result.status === "found") {
      return result.value;
    }

    if (result.status === "error") {
      throw result.error;
    }

    await sleep(250);
  }
}

export function writeExpenseEntityToFateCache(client: TrizumFateClient, expense: ExpenseEntity) {
  applyJazzFateMutationToCache(client, {
    affectedLists: [{ args: { partyId: expense.partyId }, root: "expenses" }],
    operation: "upsert",
    output: expense,
  });
}

export function writePartyEntitiesToFateCache(
  client: TrizumFateClient,
  snapshot: PartyEntitySnapshot,
) {
  applyJazzFateMutationToCache(client, {
    affectedLists: [{ root: "parties" }],
    operation: "upsert",
    output: snapshot.party,
  });

  for (const participant of snapshot.participants) {
    applyJazzFateMutationToCache(client, {
      affectedLists: [{ args: { partyId: participant.partyId }, root: "participants" }],
      operation: "upsert",
      output: participant,
    });
  }
}

async function readUserSettings(client: TrizumFateClient, userId: string) {
  try {
    const { user } = await client.request({
      user: {
        id: userId,
        view: UserSettingsView,
      },
    });
    const snapshot = await client.readView(UserSettingsView, user);
    await notifyFateReadComplete(client);

    return snapshot.data as unknown as UserEntity;
  } catch {
    return undefined;
  }
}

async function readJoinedParties(client: TrizumFateClient, userId: string) {
  const { joinedParties } = await client.request({
    joinedParties: {
      args: { userId },
      list: JoinedPartyView,
    },
  });

  const joinedPartyEntities = await Promise.all(
    joinedParties.map(async (joinedParty) => {
      const snapshot = await client.readView(JoinedPartyView, joinedParty);

      return snapshot.data as unknown as JoinedPartyEntity;
    }),
  );
  await notifyFateReadComplete(client);

  return joinedPartyEntities;
}

async function readPartyMember(
  client: TrizumFateClient,
  userId: string,
  partyId: string,
): Promise<PartyMemberEntity | undefined> {
  try {
    const { partyMember } = await client.request({
      partyMember: {
        id: getPartyMemberId(userId, partyId),
        view: PartyMemberView,
      },
    });
    const snapshot = await client.readView(PartyMemberView, partyMember);
    await notifyFateReadComplete(client);

    return snapshot.data as unknown as PartyMemberEntity;
  } catch {
    return undefined;
  }
}

async function readPartySettings(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
) {
  const result = await readPartySettingsResult(client, partyId, options);

  return result.status === "found" ? result.value : undefined;
}

async function readPartySettingsResult(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
): Promise<DataReadResult<PartyEntity>> {
  try {
    const { party } = await client.request(
      {
        party: {
          id: partyId,
          view: PartySettingsView,
        },
      },
      options,
    );
    const snapshot = await client.readView(PartySettingsView, party);
    await notifyFateReadComplete(client);

    return {
      status: "found",
      value: snapshot.data as unknown as PartyEntity,
    };
  } catch (error) {
    return readErrorAsNotFound(error);
  }
}

async function readPartyEntitiesResult(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
): Promise<DataReadResult<PartyEntitySnapshot>> {
  const party = await readPartySettingsResult(client, partyId, options);

  if (party.status === "notFound" || party.status === "error") {
    return party;
  }

  const participants = await readParticipantsResult(client, partyId, options);

  if (participants.status === "error") {
    return participants;
  }

  return {
    status: "found",
    value: {
      participants: participants.status === "notFound" ? [] : participants.value,
      party: party.value,
    },
  };
}

async function readParticipants(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
) {
  const result = await readParticipantsResult(client, partyId, options);

  return result.status === "found" || result.status === "empty" ? result.value : [];
}

async function readParticipantsResult(
  client: TrizumFateClient,
  partyId: string,
  options?: RequestOptions,
): Promise<DataReadResult<ParticipantEntity[]>> {
  try {
    const { participants } = await client.request(
      {
        participants: {
          args: { partyId },
          list: ParticipantView,
        },
      },
      options,
    );

    const participantEntities = await Promise.all(
      participants.map(async (participant) => {
        const snapshot = await client.readView(ParticipantView, participant);

        return snapshot.data as unknown as ParticipantEntity;
      }),
    );
    await notifyFateReadComplete(client);

    return {
      status: participantEntities.length === 0 ? "empty" : "found",
      value: participantEntities,
    };
  } catch (error) {
    return {
      error,
      status: "error",
    };
  }
}

export function toPartyList(
  userId: string,
  user: UserEntity | undefined,
  joinedParties: readonly JoinedPartyEntity[],
  base?: PartyList,
): PartyList {
  const next: PartyList = {
    archivedParties: { ...base?.archivedParties },
    autoOpenCalculator: user?.autoOpenCalculator ?? base?.autoOpenCalculator ?? false,
    avatarId: (user?.avatarId as string | null | undefined) ?? base?.avatarId,
    hue: user?.hue ?? base?.hue,
    id: userId,
    lastOpenedPartyId:
      (user?.lastOpenedPartyId as string | null | undefined) ?? base?.lastOpenedPartyId,
    lastUsedAt: { ...base?.lastUsedAt },
    locale: (user?.locale as SupportedLocale | undefined) ?? base?.locale,
    openLastPartyOnLaunch: user?.openLastPartyOnLaunch ?? base?.openLastPartyOnLaunch ?? false,
    participantInParties: { ...base?.participantInParties },
    parties: { ...base?.parties },
    phone: user?.phone ?? base?.phone ?? "",
    pinnedParties: { ...base?.pinnedParties },
    type: "partyList",
    username: user?.displayName ?? base?.username ?? "",
  };

  for (const joinedParty of joinedParties) {
    const partyId = joinedParty.partyId;
    next.parties[partyId] = true;

    if (joinedParty.participantId) {
      next.participantInParties[partyId] = joinedParty.participantId;
    }

    if (joinedParty.isArchived) {
      next.archivedParties![partyId] = true;
      delete next.pinnedParties![partyId];
    } else {
      delete next.archivedParties![partyId];

      if (joinedParty.isPinned) {
        next.pinnedParties![partyId] = true;
      } else {
        delete next.pinnedParties![partyId];
      }
    }

    const lastUsedAt = toTimestamp(joinedParty.lastUsedAt);

    if (lastUsedAt !== undefined) {
      next.lastUsedAt![partyId] = lastUsedAt;
    }
  }

  return next;
}

export function toParty(party: PartyEntity, participants: readonly ParticipantEntity[]): Party {
  const partyParticipants: Party["participants"] = {};

  for (const participant of participants) {
    const partyParticipant = toPartyParticipant(participant);

    partyParticipants[partyParticipant.id] = partyParticipant;
  }

  return {
    currency: party.currency as Currency,
    description: party.description,
    id: party.id,
    name: party.name,
    participants: partyParticipants,
    symbol: party.symbol ?? undefined,
    type: "party",
  };
}

export function toPartyParticipant(participant: ParticipantEntity): PartyParticipant {
  return {
    avatarId: participant.avatarId ?? undefined,
    balancesSortedBy: participant.balancesSortedBy,
    id: participant.localId,
    isArchived: participant.isArchived,
    name: participant.name,
    personalMode: participant.personalMode,
    phone: participant.phone ?? undefined,
  };
}

export function toExpense(entity: ExpenseEntity): Expense {
  const expense: Expense = {
    __editCopy: toExpenseEditCopy(entity.editCopy),
    __editCopyLastUpdatedAt: toDate(entity.editCopyLastUpdatedAt),
    __hash: entity.hash ?? "",
    id: entity.id,
    isTransfer: entity.isTransfer,
    name: entity.name,
    paidAt: toDate(entity.paidAt) ?? new Date(),
    paidBy: entity.paidBy as unknown as Expense["paidBy"],
    photos: entity.photos,
    shares: entity.shares as unknown as Expense["shares"],
  };

  if (!expense.__hash) {
    expense.__hash = calculateExpenseHash(expense);
  }

  return expense;
}

function toExpenseEditCopy(value: ExpenseEntity["editCopy"]): Expense["__editCopy"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const editCopy = value as unknown as Omit<Expense, "__editCopy">;

  return {
    ...editCopy,
    paidAt: toDate(editCopy.paidAt) ?? new Date(),
  };
}

export function toMediaFile(entity: MediaFileEntity): MediaFile {
  return {
    encodedBlob: entity.encodedBlob,
    id: entity.id,
    metadata: entity.metadata as Record<string, unknown>,
    type: "mediaFile",
  };
}

function expenseToMutationInput(partyId: string, expense: Expense) {
  return {
    amount: getExpenseTotalAmount(expense),
    editCopy: (expense.__editCopy ?? null) as JsonLike,
    editCopyLastUpdatedAt: expense.__editCopyLastUpdatedAt ?? null,
    hash: calculateExpenseHash(expense),
    id: expense.id,
    isTransfer: expense.isTransfer ?? false,
    name: expense.name,
    paidAt: expense.paidAt,
    paidBy: expense.paidBy as JsonLike,
    partyId,
    photos: expense.photos,
    shares: expense.shares as unknown as JsonLike,
  };
}

function expenseToOptimisticEntity(partyId: string, expense: Expense): ExpenseEntity {
  return {
    __typename: "Expense",
    ...expenseToMutationInput(partyId, expense),
  } as ExpenseEntity;
}

function createPartyId() {
  return crypto.randomUUID();
}

function createExpenseId() {
  return crypto.randomUUID();
}

function createInviteSecret() {
  return crypto.randomUUID();
}

function getJoinedPartyId(userId: string, partyId: string) {
  return createDeterministicEntityId(`joinedParty:${userId}:${partyId}`);
}

function getPartyMemberId(userId: string, partyId: string) {
  return createDeterministicEntityId(`partyMember:${userId}:${partyId}`);
}

function getParticipantEntityId(partyId: string, participantId: string) {
  return createDeterministicEntityId(`participant:${partyId}:${participantId}`);
}

function createDeterministicEntityId(input: string) {
  const bytes = new Uint8Array(md5(input));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function toDate(value: Date | number | string | null | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  return toDate(value)?.getTime();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<undefined>((resolve) => {
      timeoutId = setTimeout(() => resolve(undefined), timeoutMs);
    }),
  ]);
}

function throwMutationError(error: unknown) {
  if (error) {
    throw error;
  }
}

function expectMutationResult<T>(result: MutationResult<T>, message: string): T {
  throwMutationError(result.error);

  if (result.result === undefined) {
    throw new Error(message);
  }

  return result.result;
}

async function tryCreateMutation<T>(create: () => Promise<MutationResult<T>>) {
  try {
    const result = await create();

    return result.error ? undefined : result.result;
  } catch {
    return undefined;
  }
}

function readErrorAsNotFound(error: unknown): DataReadResult<never> {
  if (error instanceof Error) {
    return {
      status: "notFound",
    };
  }

  return {
    error,
    status: "error",
  };
}

async function notifyFateReadComplete(client: TrizumFateClient) {
  await refreshJazzFateCache(client, []);
}

async function primeParticipantList(client: TrizumFateClient, partyId: string) {
  const { participants } = await client.request({
    participants: {
      args: { partyId },
      list: PARTICIPANT_CONNECTION_VIEW,
    },
  });

  return (participants as FateConnectionWithMetadata)[ConnectionTag]?.key;
}

function seedParticipantList(
  client: TrizumFateClient,
  listKey: string | undefined,
  participants: readonly ParticipantEntity[],
) {
  const store = (client as unknown as FateStoreTarget).store;

  if (!listKey || !store) {
    return;
  }

  const current = store.getListState(listKey);
  const ids = participants.map((participant) => toEntityId("Participant", participant.id));

  store.setList(listKey, {
    ...current,
    cursors: participants.map((participant) => String(participant.id)),
    ids,
  });
}
