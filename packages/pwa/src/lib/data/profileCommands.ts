import type { Repo, DocHandle, DocumentId } from "@automerge/automerge-repo/slim";
import type { PartyList } from "#src/models/partyList.ts";
import type { Party, PartyParticipant } from "#src/models/party.ts";

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

export function getProfileHelpers(repo: Repo, partyListHandle: DocHandle<PartyList>) {
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
  }

  function setLastOpenedPartyId(partyId: Party["id"] | null) {
    partyListHandle.change((list) => {
      list.lastOpenedPartyId = partyId;

      if (!partyId) {
        return;
      }

      ensureLastUsedAt(list)[partyId] = Date.now();
    });
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
  }

  function updateSettings(
    values: Pick<
      PartyList,
      | "username"
      | "phone"
      | "paymentMethods"
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

      if (values.paymentMethods !== undefined) list.paymentMethods = values.paymentMethods;
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

    void updateAllParties();

    async function updateAllParties() {
      // Update all participants in all parties
      const partyList = partyListHandle.doc();

      if (!partyList) {
        return;
      }

      await Promise.all(
        Object.keys(partyList.participantInParties).map(async (partyId) => {
          // SAFETY: Membership-map keys are the document IDs assigned by Repo.
          const partyHandle = await repo
            .find<Party>(partyId as DocumentId, { signal: AbortSignal.timeout(3_000) })
            .catch(() => undefined);

          if (!partyHandle) return;

          partyHandle.change((doc) => {
            // SAFETY: partyId is a key enumerated from this same DocumentId-keyed membership map.
            const participantId = partyList.participantInParties[partyId as DocumentId];
            const participant = doc.participants[participantId];

            if (!participant) {
              return;
            }

            // Only update participant-relevant fields, not user-local settings
            const participantFields = ["phone", "paymentMethods", "avatarId"] as const;

            for (const key of participantFields) {
              const value = values[key];

              if (value === undefined) {
                // SAFETY: Only optional participant detail fields from the typed values update are deleted.
                delete participant[key as keyof typeof participant];
              } else {
                // @ts-expect-error -- idk tbh
                participant[key] = value;
              }
            }
          });
        }),
      );
    }
  }

  function dismissPremiumBanner() {
    partyListHandle.change((list) => {
      list.premiumBannerDismissed = true;
    });
  }

  function setAutoOpenCalculator(value: boolean) {
    partyListHandle.change((list) => {
      list.autoOpenCalculator = value;
    });
  }

  function setUsageAnalyticsEnabled(value: boolean) {
    partyListHandle.change((list) => {
      list.usageAnalyticsEnabled = value;
    });
  }

  return {
    addPartyToList,
    removeParty,
    updateSettings,
    setLastOpenedPartyId,
    setPartyPinned,
    setPartyArchived,
    setAutoOpenCalculator,
    setUsageAnalyticsEnabled,
    dismissPremiumBanner,
  };
}
