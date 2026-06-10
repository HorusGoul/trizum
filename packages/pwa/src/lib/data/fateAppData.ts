import {
  ExpenseListItemView,
  JoinedPartyView,
  MediaFileBlobView,
  ParticipantView,
  PartyMemberView,
  PartySettingsView,
  UserSettingsView,
  type ExpenseEntity,
  type JoinedPartyEntity,
  type MediaFileEntity,
  type ParticipantEntity,
  type PartyEntity,
  type TrizumFateClient,
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

  await upsertParty(client, userId, party);
  await Promise.all(
    values.participants.map((participant) => upsertParticipant(client, partyId, participant)),
  );

  return party;
}

export async function upsertParty(
  client: TrizumFateClient,
  userId: string,
  party: Pick<Party, "currency" | "description" | "id" | "name" | "symbol">,
) {
  const result = await client.mutations.party.upsert({
    input: {
      currency: party.currency,
      description: party.description,
      id: party.id,
      name: party.name,
      ownerUserId: userId,
      symbol: party.symbol,
    },
    view: PartySettingsView,
  });

  return expectMutationResult(result, "party.upsert did not return a result");
}

export async function upsertParticipant(
  client: TrizumFateClient,
  partyId: string,
  participant: PartyParticipant,
) {
  const result = await client.mutations.participant.upsert({
    input: {
      avatarId: participant.avatarId ?? undefined,
      balancesSortedBy: participant.balancesSortedBy ?? "name",
      id: getParticipantEntityId(partyId, participant.id),
      isArchived: participant.isArchived ?? false,
      localId: participant.id,
      name: participant.name,
      partyId,
      personalMode: participant.personalMode ?? false,
      phone: participant.phone,
    },
    view: ParticipantView,
  });

  return expectMutationResult(result, "participant.upsert did not return a result");
}

export async function upsertPartyMember(
  client: TrizumFateClient,
  userId: string,
  partyId: string,
  participantId: string,
  role: "editor" | "owner" | "viewer" = "editor",
) {
  const result = await client.mutations.partyMember.upsert({
    input: {
      id: getPartyMemberId(userId, partyId),
      participantId,
      partyId,
      role,
      userId,
    },
    view: PartyMemberView,
  });

  throwMutationError(result.error);

  return result.result;
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
  const result = await client.mutations.joinedParty.upsert({
    input: {
      id: getJoinedPartyId(userId, partyId),
      isArchived: values.isArchived,
      isPinned: values.isArchived ? false : values.isPinned,
      joinedAt: values.joinedAt,
      lastUsedAt: values.lastUsedAt,
      participantId: values.participantId,
      partyId,
      userId,
    },
    view: JoinedPartyView,
  });

  return expectMutationResult(result, "joinedParty.upsert did not return a result");
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
  const result = await client.mutations.user.upsert({
    input: {
      authMode: "localFirst",
      autoOpenCalculator: values.autoOpenCalculator ?? current?.autoOpenCalculator ?? false,
      avatarId: values.avatarId ?? current?.avatarId ?? undefined,
      displayName: values.username ?? current?.displayName ?? undefined,
      hue: values.hue ?? current?.hue,
      id: userId,
      lastOpenedPartyId: values.lastOpenedPartyId ?? current?.lastOpenedPartyId ?? undefined,
      locale: values.locale ?? current?.locale,
      openLastPartyOnLaunch:
        values.openLastPartyOnLaunch ?? current?.openLastPartyOnLaunch ?? false,
      phone: values.phone ?? current?.phone ?? undefined,
    },
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
): Promise<Party | undefined> {
  const party = await readPartySettings(client, partyId);

  if (!party) {
    return undefined;
  }

  const participants = await readParticipants(client, partyId);

  return toParty(party, participants);
}

export async function readPartyList(client: TrizumFateClient, userId: string): Promise<PartyList> {
  const user = await readUserSettings(client, userId);
  const joinedParties = await readJoinedParties(client, userId);

  return toPartyList(userId, user, joinedParties);
}

export async function readExpenseById(client: TrizumFateClient, expenseId: string) {
  try {
    const { expense } = await client.request({
      expense: {
        id: expenseId,
        view: ExpenseListItemView,
      },
    });
    const snapshot = await client.readView(ExpenseListItemView, expense);

    return toExpense(snapshot.data as unknown as ExpenseEntity);
  } catch {
    return undefined;
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

  return Promise.all(
    joinedParties.map(async (joinedParty) => {
      const snapshot = await client.readView(JoinedPartyView, joinedParty);

      return snapshot.data as unknown as JoinedPartyEntity;
    }),
  );
}

async function readPartySettings(client: TrizumFateClient, partyId: string) {
  try {
    const { party } = await client.request({
      party: {
        id: partyId,
        view: PartySettingsView,
      },
    });
    const snapshot = await client.readView(PartySettingsView, party);

    return snapshot.data as unknown as PartyEntity;
  } catch {
    return undefined;
  }
}

async function readParticipants(client: TrizumFateClient, partyId: string) {
  const { participants } = await client.request({
    participants: {
      args: { partyId },
      list: ParticipantView,
    },
  });

  return Promise.all(
    participants.map(async (participant) => {
      const snapshot = await client.readView(ParticipantView, participant);

      return snapshot.data as unknown as ParticipantEntity;
    }),
  );
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
    __editCopy: entity.editCopy as unknown as Expense["__editCopy"],
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
    editCopy: expense.__editCopy as JsonLike | undefined,
    editCopyLastUpdatedAt: expense.__editCopyLastUpdatedAt,
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
