import { useEffect } from "react";
import {
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

export function usePartyList() {
  const { client, userId } = useTrizumData();
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
  const joinedPartyEntities = useFateLiveViews(JoinedPartyView, joinedPartyRefs);
  const partyList = toPartyList(userId, userSettings, joinedPartyEntities);

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);

  useEffect(() => {
    setThemeHue(partyList.hue ?? defaultThemeHue);
  }, [partyList.hue]);

  async function addPartyToList(partyId: Party["id"], participantId: PartyParticipant["id"]) {
    await upsertPartyMember(client, userId, partyId, participantId);
    await upsertJoinedParty(client, userId, partyId, {
      isArchived: false,
      isPinned: partyList.pinnedParties?.[partyId] === true,
      joinedAt: new Date(),
      lastUsedAt: new Date(),
      participantId,
    });
  }

  async function removeParty(partyId: Party["id"]) {
    await upsertJoinedParty(client, userId, partyId, {
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
      await upsertJoinedParty(client, userId, partyId, {
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

    await upsertJoinedParty(client, userId, partyId, {
      isArchived: false,
      isPinned: pinned,
      lastUsedAt: toDate(partyList.lastUsedAt?.[partyId]) ?? new Date(),
      participantId: partyList.participantInParties[partyId],
    });
  }

  async function setPartyArchived(partyId: Party["id"], archived: boolean) {
    await upsertJoinedParty(client, userId, partyId, {
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
