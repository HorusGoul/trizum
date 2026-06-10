import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import {
  JoinedPartyView,
  ParticipantView,
  PartyMemberView,
  PartySettingsView,
  UserSettingsView,
  type JoinedPartyEntity,
  type TrizumFateClient,
  type UserEntity,
} from "@trizum/data";
import { useEffect, useSyncExternalStore } from "react";
import { createCache } from "suspense";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { getLogger } from "#src/lib/log.ts";
import type { Party, PartyParticipant } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import type { SupportedLocale } from "#src/lib/i18n.js";
import { useTrizumData } from "./TrizumDataContext.js";

const logger = getLogger("lib", "data", "fatePartyList");

export const fateUserSettingsCache = createCache<
  [TrizumFateClient, string],
  UserEntity | undefined
>({
  async load(params): Promise<UserEntity | undefined> {
    const [client, userId] = params;

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
  },
  getKey: ([_, userId]) => userId,
});

export const fateJoinedPartiesCache = createCache<[TrizumFateClient, string], JoinedPartyEntity[]>({
  async load(params): Promise<JoinedPartyEntity[]> {
    const [client, userId] = params;

    try {
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
    } catch {
      return [];
    }
  },
  getKey: ([_, userId]) => userId,
});

export function useFatePartyListState(legacyPartyList: PartyList): PartyList {
  const { client, userId } = useTrizumData();
  const userSettings = useFateUserSettings(client, userId);
  const joinedParties = useFateJoinedParties(client, userId);

  return applyFatePartyListState(legacyPartyList, userSettings, joinedParties);
}

export function useMirrorPartyListToFate(repo: Repo, partyList: PartyList) {
  const { client, userId } = useTrizumData();
  const mirrorKey = getPartyListMirrorKey(partyList);

  useEffect(() => {
    void mirrorPartyListToFate({
      client,
      partyList,
      repo,
      userId,
    });
  }, [client, mirrorKey, partyList, repo, userId]);
}

export function applyFatePartyListState(
  legacyPartyList: PartyList,
  userSettings: UserEntity | undefined,
  joinedParties: readonly JoinedPartyEntity[],
): PartyList {
  const next: PartyList = {
    ...legacyPartyList,
    archivedParties: { ...legacyPartyList.archivedParties },
    lastUsedAt: { ...legacyPartyList.lastUsedAt },
    participantInParties: { ...legacyPartyList.participantInParties },
    parties: { ...legacyPartyList.parties },
    pinnedParties: { ...legacyPartyList.pinnedParties },
  };

  if (userSettings) {
    next.username = userSettings.displayName ?? next.username;
    next.phone = userSettings.phone ?? next.phone;
    next.avatarId = (userSettings.avatarId as DocumentId | null | undefined) ?? next.avatarId;
    next.locale = (userSettings.locale as SupportedLocale | undefined) ?? next.locale;
    next.hue = userSettings.hue ?? next.hue;
    next.openLastPartyOnLaunch = userSettings.openLastPartyOnLaunch ?? next.openLastPartyOnLaunch;
    next.autoOpenCalculator = userSettings.autoOpenCalculator ?? next.autoOpenCalculator;
    next.lastOpenedPartyId =
      (userSettings.lastOpenedPartyId as DocumentId | null | undefined) ?? next.lastOpenedPartyId;
  }

  for (const joinedParty of joinedParties) {
    const partyId = joinedParty.partyId as DocumentId;

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

export async function mirrorPartyListToFate({
  client,
  partyList,
  repo,
  userId,
}: {
  client: TrizumFateClient;
  partyList: PartyList;
  repo: Repo;
  userId: string;
}) {
  await safeMirror(() => upsertFateUserFromPartyList(client, userId, partyList));

  await Promise.all(
    Object.keys(partyList.parties).map(async (partyId) => {
      if (partyList.parties[partyId as DocumentId] !== true) {
        return;
      }

      await safeMirror(() =>
        mirrorPartyReferenceToFate({
          client,
          partyId: partyId as DocumentId,
          partyList,
          repo,
          userId,
        }),
      );
    }),
  );
}

export async function upsertFateUserFromPartyList(
  client: TrizumFateClient,
  userId: string,
  partyList: PartyList,
) {
  const result = await client.mutations.user.upsert({
    input: {
      authMode: "localFirst",
      autoOpenCalculator: partyList.autoOpenCalculator ?? false,
      avatarId: partyList.avatarId ?? undefined,
      displayName: partyList.username || undefined,
      hue: partyList.hue,
      id: userId,
      lastOpenedPartyId: partyList.lastOpenedPartyId ?? undefined,
      locale: partyList.locale,
      openLastPartyOnLaunch: partyList.openLastPartyOnLaunch ?? false,
      phone: partyList.phone || undefined,
    },
    view: UserSettingsView,
  });

  if (result.error) {
    throw result.error;
  }

  fateUserSettingsCache.cache(result.result, client, userId);

  return result.result;
}

export async function mirrorPartyReferenceToFate({
  client,
  partyId,
  partyList,
  repo,
  userId,
}: {
  client: TrizumFateClient;
  partyId: DocumentId;
  partyList: PartyList;
  repo: Repo;
  userId: string;
}) {
  const party = (await documentCache.readAsync(repo, partyId)) as Party | undefined;

  if (!party) {
    return;
  }

  const participantId = partyList.participantInParties?.[partyId];
  const participant = participantId ? party.participants[participantId] : undefined;

  await upsertFateParty(client, userId, party);

  if (participant) {
    await upsertFateParticipant(client, party, participant);
    await upsertFatePartyMember(client, userId, party, participant);
  }

  await upsertFateJoinedParty(client, userId, partyId, {
    isArchived: partyList.archivedParties?.[partyId] === true,
    isPinned: partyList.pinnedParties?.[partyId] === true,
    joinedAt: new Date(toTimestamp(partyList.lastUsedAt?.[partyId]) ?? Date.now()),
    lastUsedAt: new Date(toTimestamp(partyList.lastUsedAt?.[partyId]) ?? Date.now()),
    participantId,
  });
}

export async function upsertFateJoinedParty(
  client: TrizumFateClient,
  userId: string,
  partyId: DocumentId,
  values: {
    isArchived: boolean;
    isPinned: boolean;
    joinedAt?: Date;
    lastUsedAt?: Date;
    participantId?: PartyParticipant["id"];
  },
) {
  const result = await client.mutations.joinedParty.upsert({
    input: {
      id: getFateJoinedPartyId(userId, partyId),
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

  if (result.error) {
    throw result.error;
  }

  cacheJoinedParty(client, userId, result.result);

  return result.result;
}

function useFateUserSettings(client: TrizumFateClient, userId: string) {
  fateUserSettingsCache.read(client, userId);

  return useSyncExternalStore(
    (change) => fateUserSettingsCache.subscribe(change, client, userId),
    () => fateUserSettingsCache.getValueIfCached(client, userId),
  );
}

function useFateJoinedParties(client: TrizumFateClient, userId: string) {
  fateJoinedPartiesCache.read(client, userId);

  return (
    useSyncExternalStore(
      (change) => fateJoinedPartiesCache.subscribe(change, client, userId),
      () => fateJoinedPartiesCache.getValueIfCached(client, userId),
    ) ?? []
  );
}

async function upsertFateParty(client: TrizumFateClient, userId: string, party: Party) {
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

  if (result.error) {
    throw result.error;
  }

  return result.result;
}

async function upsertFateParticipant(
  client: TrizumFateClient,
  party: Party,
  participant: PartyParticipant,
) {
  const result = await client.mutations.participant.upsert({
    input: {
      avatarId: participant.avatarId ?? undefined,
      balancesSortedBy: participant.balancesSortedBy ?? "name",
      id: participant.id,
      isArchived: participant.isArchived ?? false,
      name: participant.name,
      partyId: party.id,
      personalMode: participant.personalMode ?? false,
      phone: participant.phone,
    },
    view: ParticipantView,
  });

  if (result.error) {
    throw result.error;
  }

  return result.result;
}

async function upsertFatePartyMember(
  client: TrizumFateClient,
  userId: string,
  party: Party,
  participant: PartyParticipant,
) {
  const result = await client.mutations.partyMember.upsert({
    input: {
      id: getFatePartyMemberId(userId, party.id),
      participantId: participant.id,
      partyId: party.id,
      role: "owner",
      userId,
    },
    view: PartyMemberView,
  });

  if (result.error) {
    throw result.error;
  }

  return result.result;
}

async function safeMirror(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    logger.warn("Could not mirror legacy party list state to Fate", { error });
  }
}

function cacheJoinedParty(
  client: TrizumFateClient,
  userId: string,
  joinedParty: JoinedPartyEntity,
) {
  const current = fateJoinedPartiesCache.getValueIfCached(client, userId);

  if (!current) {
    return;
  }

  const index = current.findIndex((candidate) => candidate.id === joinedParty.id);
  const next = [...current];

  if (index === -1) {
    next.push(joinedParty);
  } else {
    next[index] = joinedParty;
  }

  fateJoinedPartiesCache.cache(next, client, userId);
}

function getPartyListMirrorKey(partyList: PartyList) {
  return JSON.stringify({
    archivedParties: partyList.archivedParties,
    autoOpenCalculator: partyList.autoOpenCalculator,
    avatarId: partyList.avatarId,
    hue: partyList.hue,
    lastOpenedPartyId: partyList.lastOpenedPartyId,
    lastUsedAt: partyList.lastUsedAt,
    locale: partyList.locale,
    openLastPartyOnLaunch: partyList.openLastPartyOnLaunch,
    participantInParties: partyList.participantInParties,
    parties: partyList.parties,
    phone: partyList.phone,
    pinnedParties: partyList.pinnedParties,
    username: partyList.username,
  });
}

function getFateJoinedPartyId(userId: string, partyId: DocumentId) {
  return `joinedParty:${encodeURIComponent(userId)}:${encodeURIComponent(partyId)}`;
}

function getFatePartyMemberId(userId: string, partyId: DocumentId) {
  return `partyMember:${encodeURIComponent(userId)}:${encodeURIComponent(partyId)}`;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? undefined : timestamp;
  }

  return undefined;
}
