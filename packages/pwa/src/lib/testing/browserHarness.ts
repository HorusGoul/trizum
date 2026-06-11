import type { TrizumFateClient } from "@trizum/data";
import type { SupportedLocale } from "#src/lib/i18n.js";
import {
  readExpenseById,
  readPartyList,
  upsertJoinedParty,
  upsertUserSettings,
} from "#src/lib/data/fateAppData.ts";
import type { Expense } from "#src/models/expense.js";
import type { PartyList } from "#src/models/partyList.js";

export interface InternalPartyListSeed {
  username?: string;
  phone?: string;
  avatarId?: string | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
  autoOpenCalculator?: boolean;
  hue?: number;
  lastOpenedPartyId?: string | null;
  parties?: PartyList["parties"];
  pinnedParties?: NonNullable<PartyList["pinnedParties"]>;
  archivedParties?: NonNullable<PartyList["archivedParties"]>;
  lastUsedAt?: NonNullable<PartyList["lastUsedAt"]>;
  participantInParties?: PartyList["participantInParties"];
}

export interface InternalPartyListSeedResult {
  partyListId: string;
}

export interface InternalPartyListSnapshot {
  partyListId: string;
  lastOpenedPartyId: string | null;
  parties: PartyList["parties"];
  pinnedParties: NonNullable<PartyList["pinnedParties"]>;
  archivedParties: NonNullable<PartyList["archivedParties"]>;
  lastUsedAt: NonNullable<PartyList["lastUsedAt"]>;
  participantInParties: PartyList["participantInParties"];
}

export async function seedPartyListState({
  client,
  seed,
  userId,
}: {
  client: TrizumFateClient;
  seed: InternalPartyListSeed;
  userId: string;
}): Promise<InternalPartyListSeedResult> {
  await upsertUserSettings(client, userId, {
    autoOpenCalculator: seed.autoOpenCalculator ?? false,
    avatarId: seed.avatarId,
    hue: seed.hue,
    lastOpenedPartyId: seed.lastOpenedPartyId ?? null,
    locale: seed.locale,
    openLastPartyOnLaunch: seed.openLastPartyOnLaunch ?? false,
    phone: seed.phone ?? "",
    username: seed.username ?? "",
  });

  await Promise.all(
    Object.keys(seed.parties ?? {}).map(async (partyId) => {
      if (seed.parties?.[partyId] !== true) {
        return;
      }

      await upsertJoinedParty(client, userId, partyId, {
        isArchived: seed.archivedParties?.[partyId] === true,
        isPinned: seed.pinnedParties?.[partyId] === true,
        joinedAt: toDate(seed.lastUsedAt?.[partyId]) ?? new Date(),
        lastUsedAt: toDate(seed.lastUsedAt?.[partyId]) ?? new Date(),
        participantId: seed.participantInParties?.[partyId],
      });
    }),
  );

  return {
    partyListId: userId,
  };
}

export async function readPartyListState({
  client,
  userId,
}: {
  client: TrizumFateClient;
  userId: string;
}): Promise<InternalPartyListSnapshot> {
  const partyList = await readPartyList(client, userId);

  return {
    partyListId: userId,
    lastOpenedPartyId: partyList.lastOpenedPartyId ?? null,
    parties: { ...partyList.parties },
    pinnedParties: { ...(partyList.pinnedParties ?? {}) },
    archivedParties: { ...(partyList.archivedParties ?? {}) },
    lastUsedAt: { ...(partyList.lastUsedAt ?? {}) },
    participantInParties: {
      ...partyList.participantInParties,
    },
  };
}

export async function readExpenseState({
  client,
  expenseId,
}: {
  client: TrizumFateClient;
  expenseId: Expense["id"];
}) {
  return (await readExpenseById(client, expenseId)) ?? null;
}

function toDate(value: number | undefined) {
  return typeof value === "number" ? new Date(value) : undefined;
}
