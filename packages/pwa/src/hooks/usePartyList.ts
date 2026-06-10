import { useEffect, useState } from "react";
import { getPartyListId, type PartyList } from "#src/models/partyList.js";
import type { DocHandle, DocumentId } from "@automerge/automerge-repo/slim";
import type { Party, PartyParticipant } from "#src/models/party.js";
import {
  documentCache,
  handleCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { getBrowserLocale, setLocale } from "#src/lib/i18n.js";
import {
  mirrorPartyReferenceToFate,
  upsertFateJoinedParty,
  upsertFateUserFromPartyList,
  useFatePartyListState,
  useMirrorPartyListToFate,
} from "#src/lib/data/fatePartyList.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { getLogger } from "#src/lib/log.ts";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";

const logger = getLogger("hooks", "usePartyList");

function ensurePinnedParties(list: PartyList) {
  if (!list.pinnedParties) {
    list.pinnedParties = {};
  }

  return list.pinnedParties;
}

function ensureArchivedParties(list: PartyList) {
  if (!list.archivedParties) {
    list.archivedParties = {};
  }

  return list.archivedParties;
}

function ensureLastUsedAt(list: PartyList) {
  if (!list.lastUsedAt) {
    list.lastUsedAt = {};
  }

  return list.lastUsedAt;
}

export function usePartyList() {
  const repo = useRepo();
  const { client, userId } = useTrizumData();
  const [partyListId] = useState<DocumentId>(() => getPartyListId(repo));
  const [legacyPartyList, partyListHandle] = useSuspenseDocument<PartyList>(partyListId, {
    required: true,
  });
  const partyList = useFatePartyListState(legacyPartyList);

  useMirrorPartyListToFate(repo, legacyPartyList);

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);

  useEffect(() => {
    setThemeHue(partyList.hue ?? defaultThemeHue);
  }, [partyList.hue]);

  function addPartyToList(partyId: Party["id"], participantId: PartyParticipant["id"]) {
    partyListHandle.change((list) => {
      list.parties[partyId] = true;
      delete ensureArchivedParties(list)[partyId];
      ensureLastUsedAt(list)[partyId] = Date.now();

      if (!list.participantInParties) {
        list.participantInParties = {};
      }

      list.participantInParties[partyId] = participantId;
    });
    mirrorPartyToFate(partyId);
  }
  function removeParty(partyId: Party["id"]) {
    // TODO: mark for deletion during next boot

    partyListHandle.change((list) => {
      delete list.parties[partyId];
      delete ensurePinnedParties(list)[partyId];
      delete ensureArchivedParties(list)[partyId];
      delete ensureLastUsedAt(list)[partyId];

      if (list.lastOpenedPartyId === partyId) {
        list.lastOpenedPartyId = null;
      }

      if (!list.participantInParties) {
        return;
      }

      delete list.participantInParties[partyId];
    });
    mirrorJoinedPartyToFate(partyId, {
      isArchived: true,
      isPinned: false,
      lastUsedAt: new Date(),
    });
  }

  function setLastOpenedPartyId(partyId: Party["id"] | null) {
    partyListHandle.change((list) => {
      list.lastOpenedPartyId = partyId;

      if (!partyId) {
        return;
      }

      ensureLastUsedAt(list)[partyId] = Date.now();
    });

    const nextPartyList = partyListHandle.doc();

    if (nextPartyList) {
      mirrorUserToFate(nextPartyList);
    }

    if (partyId) {
      mirrorPartyToFate(partyId);
    }
  }

  function setPartyPinned(partyId: Party["id"], pinned: boolean) {
    partyListHandle.change((list) => {
      const pinnedParties = ensurePinnedParties(list);
      const archivedParties = ensureArchivedParties(list);

      if (pinned) {
        if (archivedParties[partyId]) {
          return;
        }

        pinnedParties[partyId] = true;
        return;
      }

      delete pinnedParties[partyId];
    });
    mirrorPartyToFate(partyId);
  }

  function setPartyArchived(partyId: Party["id"], archived: boolean) {
    partyListHandle.change((list) => {
      const archivedParties = ensureArchivedParties(list);
      const pinnedParties = ensurePinnedParties(list);

      if (archived) {
        archivedParties[partyId] = true;
        delete pinnedParties[partyId];

        if (list.lastOpenedPartyId === partyId) {
          list.lastOpenedPartyId = null;
        }

        return;
      }

      delete archivedParties[partyId];
    });
    mirrorPartyToFate(partyId);
  }

  function updateSettings(
    values: Pick<
      PartyList,
      | "username"
      | "phone"
      | "avatarId"
      | "locale"
      | "openLastPartyOnLaunch"
      | "autoOpenCalculator"
      | "hue"
    >,
  ) {
    partyListHandle.change((list) => {
      list.username = values.username;
      list.phone = values.phone;
      list.avatarId = values.avatarId;
      if (values.locale) {
        list.locale = values.locale;
      } else {
        delete list["locale"];
      }
      list.openLastPartyOnLaunch = values.openLastPartyOnLaunch;
      list.autoOpenCalculator = values.autoOpenCalculator;
      list.hue = values.hue;
    });
    mirrorUserToFate({
      ...legacyPartyList,
      ...values,
    });

    void updateAllParties();

    async function updateAllParties() {
      // Update all participants in all parties
      const partyList = partyListHandle.doc();

      if (!partyList) {
        return;
      }

      for (const partyId in partyList.participantInParties) {
        const party = await documentCache.readAsync(repo, partyId as DocumentId);

        if (!party) {
          continue;
        }

        const partyHandle = handleCache.read(repo, partyId as DocumentId) as DocHandle<Party>;

        partyHandle.change((doc) => {
          const participantId = partyList.participantInParties[partyId as DocumentId];
          const participant = doc.participants[participantId];

          if (!participant) {
            return;
          }

          // Only update participant-relevant fields, not user-local settings
          const participantFields = ["phone", "avatarId"] as const;
          for (const key of participantFields) {
            const value = values[key];

            if (value === undefined) {
              delete participant[key as keyof typeof participant];
            } else {
              // @ts-expect-error -- idk tbh
              participant[key] = value;
            }
          }
        });
      }
    }
  }

  function setAutoOpenCalculator(value: boolean) {
    partyListHandle.change((list) => {
      list.autoOpenCalculator = value;
    });
    mirrorUserToFate({
      ...legacyPartyList,
      autoOpenCalculator: value,
    });
  }

  function mirrorUserToFate(nextPartyList: PartyList) {
    void upsertFateUserFromPartyList(client, userId, nextPartyList).catch((error) => {
      logger.warn("Could not mirror party list user settings to Fate", { error });
    });
  }

  function mirrorPartyToFate(partyId: Party["id"]) {
    const nextPartyList = partyListHandle.doc() ?? partyList;

    void mirrorPartyReferenceToFate({
      client,
      partyId,
      partyList: nextPartyList,
      repo,
      userId,
    }).catch((error) => {
      logger.warn("Could not mirror joined party state to Fate", { error });
    });
  }

  function mirrorJoinedPartyToFate(
    partyId: Party["id"],
    values: {
      isArchived: boolean;
      isPinned: boolean;
      lastUsedAt: Date;
    },
  ) {
    void upsertFateJoinedParty(client, userId, partyId, {
      ...values,
      participantId: partyList.participantInParties[partyId],
    }).catch((error) => {
      logger.warn("Could not mirror joined party state to Fate", { error });
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
