import { useEffect, useSyncExternalStore } from "react";
import {
  createJoinedPartyEntity,
  readParty,
  toPartyList,
  upsertJoinedParty,
  upsertParticipant,
  upsertPartyMember,
  upsertUserSettings,
} from "#src/lib/data/fateAppData.ts";
import {
  useFateLiveListView,
  useFateLiveView,
  useFateLiveViews,
  useFateRequest,
} from "#src/lib/data/fateReact.ts";
import { JOINED_PARTY_CONNECTION_VIEW } from "#src/lib/data/trizumFateViews.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { getBrowserLocale, setLocale } from "#src/lib/i18n.js";
import type { Party, PartyParticipant } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { JoinedPartyView, UserSettingsView, type JoinedPartyEntity } from "@trizum/data";

const pendingJoinedPartiesByUserId = new Map<string, Map<string, JoinedPartyEntity>>();
const pendingJoinedPartyListeners = new Set<() => void>();
let pendingJoinedPartyVersion = 0;

export function usePartyList() {
  const { client, edgeWriteClient, userId } = useTrizumData();
  const { joinedParties, user } = useFateRequest({
    joinedParties: {
      args: { userId },
      list: JOINED_PARTY_CONNECTION_VIEW,
    },
    user: {
      id: userId,
      view: UserSettingsView,
    },
  });
  const userSettings = useFateLiveView(UserSettingsView, user);
  const joinedPartyRefs = useFateLiveListView<JoinedPartyEntity>(
    JOINED_PARTY_CONNECTION_VIEW,
    joinedParties,
  ).items.map(({ node }) => node);
  const liveJoinedPartyEntities = useFateLiveViews(JoinedPartyView, joinedPartyRefs);
  useSyncExternalStore(
    subscribeToPendingJoinedParties,
    getPendingJoinedPartyVersion,
    getServerPendingJoinedPartyVersion,
  );
  const joinedPartyEntities = mergeJoinedPartyEntities(
    liveJoinedPartyEntities,
    getPendingJoinedParties(userId),
  );
  const partyList = toPartyList(userId, userSettings, joinedPartyEntities);

  useEffect(() => {
    prunePendingJoinedParties(
      userId,
      new Map(liveJoinedPartyEntities.map((joinedParty) => [joinedParty.id, joinedParty])),
    );
  }, [liveJoinedPartyEntities, userId]);

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);

  useEffect(() => {
    setThemeHue(partyList.hue ?? defaultThemeHue);
  }, [partyList.hue]);

  async function addPartyToList(partyId: Party["id"], participantId: PartyParticipant["id"]) {
    const joinedParty = saveJoinedParty(partyId, {
      isArchived: false,
      isPinned: partyList.pinnedParties?.[partyId] === true,
      joinedAt: new Date(),
      lastUsedAt: new Date(),
      participantId,
    });

    try {
      await upsertPartyMember(edgeWriteClient, userId, partyId, participantId);
      await joinedParty;
    } catch (error) {
      await joinedParty.catch(() => undefined);
      throw error;
    }
  }

  async function removeParty(partyId: Party["id"]) {
    await saveJoinedParty(partyId, {
      isArchived: true,
      isPinned: false,
      lastUsedAt: new Date(),
      participantId: partyList.participantInParties[partyId],
    });

    if (partyList.lastOpenedPartyId === partyId) {
      await upsertUserSettings(client, userId, {
        lastOpenedPartyId: null,
      });
    }
  }

  async function setLastOpenedPartyId(partyId: Party["id"] | null) {
    await upsertUserSettings(client, userId, {
      lastOpenedPartyId: partyId,
    });

    if (partyId) {
      await saveJoinedParty(partyId, {
        isArchived: partyList.archivedParties?.[partyId] === true,
        isPinned: partyList.pinnedParties?.[partyId] === true,
        lastUsedAt: new Date(),
        participantId: partyList.participantInParties[partyId],
      });
    }
  }

  async function setPartyPinned(partyId: Party["id"], pinned: boolean) {
    if (partyList.archivedParties?.[partyId]) {
      return;
    }

    await saveJoinedParty(partyId, {
      isArchived: false,
      isPinned: pinned,
      lastUsedAt: toDate(partyList.lastUsedAt?.[partyId]) ?? new Date(),
      participantId: partyList.participantInParties[partyId],
    });
  }

  async function setPartyArchived(partyId: Party["id"], archived: boolean) {
    await saveJoinedParty(partyId, {
      isArchived: archived,
      isPinned: archived ? false : partyList.pinnedParties?.[partyId] === true,
      lastUsedAt: toDate(partyList.lastUsedAt?.[partyId]) ?? new Date(),
      participantId: partyList.participantInParties[partyId],
    });

    if (archived && partyList.lastOpenedPartyId === partyId) {
      await upsertUserSettings(client, userId, {
        lastOpenedPartyId: null,
      });
    }
  }

  async function updateSettings(
    values: Pick<
      PartyList,
      | "autoOpenCalculator"
      | "avatarId"
      | "hue"
      | "locale"
      | "openLastPartyOnLaunch"
      | "phone"
      | "username"
    >,
  ) {
    await upsertUserSettings(client, userId, values);

    await Promise.all(
      Object.entries(partyList.participantInParties).map(async ([partyId, participantId]) => {
        const party = await readParty(client, partyId);
        const participant = party?.participants[participantId];

        if (!participant) {
          return;
        }

        await upsertParticipant(client, partyId, {
          ...participant,
          id: participantId,
          phone: values.phone,
          avatarId: values.avatarId,
        });
      }),
    );
  }

  async function setAutoOpenCalculator(value: boolean) {
    await upsertUserSettings(client, userId, {
      autoOpenCalculator: value,
    });
  }

  async function saveJoinedParty(
    partyId: Party["id"],
    values: Parameters<typeof upsertJoinedParty>[3],
  ) {
    const optimisticJoinedParty = createJoinedPartyEntity(userId, partyId, values);
    setPendingJoinedParty(userId, optimisticJoinedParty);

    try {
      const joinedParty = await upsertJoinedParty(client, userId, partyId, values);

      if (joinedParty) {
        setPendingJoinedParty(userId, joinedParty);
      }

      return joinedParty ?? optimisticJoinedParty;
    } catch (error) {
      removePendingJoinedParty(userId, optimisticJoinedParty.id);
      throw error;
    }
  }

  return {
    partyList,
    addPartyToList,
    removeParty,
    updateSettings,
    setLastOpenedPartyId,
    setPartyPinned,
    setPartyArchived,
    setAutoOpenCalculator,
  };
}

function toDate(value: number | undefined) {
  return typeof value === "number" ? new Date(value) : undefined;
}

function subscribeToPendingJoinedParties(change: () => void) {
  pendingJoinedPartyListeners.add(change);

  return () => {
    pendingJoinedPartyListeners.delete(change);
  };
}

function getPendingJoinedPartyVersion() {
  return pendingJoinedPartyVersion;
}

function getServerPendingJoinedPartyVersion() {
  return 0;
}

function getPendingJoinedParties(userId: string) {
  return [...(pendingJoinedPartiesByUserId.get(userId)?.values() ?? [])];
}

function mergeJoinedPartyEntities(
  liveJoinedParties: readonly JoinedPartyEntity[],
  pendingJoinedParties: readonly JoinedPartyEntity[],
) {
  if (pendingJoinedParties.length === 0) {
    return liveJoinedParties;
  }

  const joinedPartiesById = new Map(
    liveJoinedParties.map((joinedParty) => [joinedParty.id, joinedParty]),
  );

  for (const joinedParty of pendingJoinedParties) {
    joinedPartiesById.set(joinedParty.id, {
      ...joinedPartiesById.get(joinedParty.id),
      ...joinedParty,
    });
  }

  return [...joinedPartiesById.values()];
}

function setPendingJoinedParty(userId: string, joinedParty: JoinedPartyEntity) {
  const joinedPartiesById = getPendingJoinedPartyMap(userId);
  const previous = joinedPartiesById.get(joinedParty.id);

  if (previous && areJoinedPartiesEqual(previous, joinedParty)) {
    return;
  }

  joinedPartiesById.set(joinedParty.id, joinedParty);
  emitPendingJoinedPartyChange();
}

function removePendingJoinedParty(userId: string, joinedPartyId: string) {
  const joinedPartiesById = pendingJoinedPartiesByUserId.get(userId);

  if (!joinedPartiesById?.delete(joinedPartyId)) {
    return;
  }

  if (joinedPartiesById.size === 0) {
    pendingJoinedPartiesByUserId.delete(userId);
  }

  emitPendingJoinedPartyChange();
}

function prunePendingJoinedParties(
  userId: string,
  liveJoinedPartiesById: ReadonlyMap<string, JoinedPartyEntity>,
) {
  const joinedPartiesById = pendingJoinedPartiesByUserId.get(userId);

  if (!joinedPartiesById) {
    return;
  }

  let didChange = false;

  for (const [joinedPartyId, pendingJoinedParty] of joinedPartiesById) {
    const liveJoinedParty = liveJoinedPartiesById.get(joinedPartyId);

    if (liveJoinedParty && doesLiveJoinedPartyCoverPending(liveJoinedParty, pendingJoinedParty)) {
      joinedPartiesById.delete(joinedPartyId);
      didChange = true;
    }
  }

  if (joinedPartiesById.size === 0) {
    pendingJoinedPartiesByUserId.delete(userId);
  }

  if (didChange) {
    emitPendingJoinedPartyChange();
  }
}

function getPendingJoinedPartyMap(userId: string) {
  let joinedPartiesById = pendingJoinedPartiesByUserId.get(userId);

  if (!joinedPartiesById) {
    joinedPartiesById = new Map();
    pendingJoinedPartiesByUserId.set(userId, joinedPartiesById);
  }

  return joinedPartiesById;
}

function emitPendingJoinedPartyChange() {
  pendingJoinedPartyVersion += 1;

  for (const listener of pendingJoinedPartyListeners) {
    listener();
  }
}

function areJoinedPartiesEqual(left: JoinedPartyEntity, right: JoinedPartyEntity) {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.partyId === right.partyId &&
    left.participantId === right.participantId &&
    left.isArchived === right.isArchived &&
    left.isPinned === right.isPinned &&
    areEntityDatesEqual(left.joinedAt, right.joinedAt) &&
    areEntityDatesEqual(left.lastUsedAt, right.lastUsedAt)
  );
}

function doesLiveJoinedPartyCoverPending(live: JoinedPartyEntity, pending: JoinedPartyEntity) {
  return (
    live.id === pending.id &&
    live.userId === pending.userId &&
    live.partyId === pending.partyId &&
    live.participantId === pending.participantId &&
    live.isArchived === pending.isArchived &&
    live.isPinned === pending.isPinned &&
    (pending.joinedAt === undefined || areEntityDatesEqual(live.joinedAt, pending.joinedAt)) &&
    (pending.lastUsedAt === undefined || areEntityDatesEqual(live.lastUsedAt, pending.lastUsedAt))
  );
}

function areEntityDatesEqual(
  left: Date | null | string | undefined,
  right: Date | null | string | undefined,
) {
  return toEntityDateTimestamp(left) === toEntityDateTimestamp(right);
}

function toEntityDateTimestamp(value: Date | null | string | undefined) {
  if (value == null) {
    return undefined;
  }

  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
