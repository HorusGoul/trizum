import { useEffect, useState } from "react";
import { getPartyListId, type PartyList } from "#src/models/partyList.js";
import type { DocumentId } from "@trizum/sdk";
import { useTrizumClient } from "@trizum/sdk";
import type { Party, PartyParticipant } from "#src/models/party.js";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import { getBrowserLocale, setLocale } from "#src/lib/i18n.js";

export function usePartyList() {
  const client = useTrizumClient();
  const repo = client._internalRepo;
  const [partyListId] = useState<DocumentId>(() => getPartyListId(client));
  const [partyList, partyListHandle] = useSuspenseDocument<PartyList>(
    partyListId,
    {
      required: true,
    },
  );

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);

  function addPartyToList(
    partyId: Party["id"],
    participantId: PartyParticipant["id"],
  ) {
    partyListHandle.change((list) => {
      list.parties[partyId] = true;

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

      if (!list.participantInParties) {
        return;
      }

      delete list.participantInParties[partyId];
    });
  }

  function setLastOpenedPartyId(partyId: Party["id"] | null) {
    partyListHandle.change((list) => {
      list.lastOpenedPartyId = partyId;
    });
  }

  function updateSettings(
    values: Pick<
      PartyList,
      "username" | "phone" | "avatarId" | "locale" | "openLastPartyOnLaunch"
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
    });

    void updateAllParties();

    async function updateAllParties() {
      // Update all participants in all parties
      const partyList = partyListHandle.doc();

      if (!partyList) {
        return;
      }

      for (const partyId in partyList.participantInParties) {
        const party = await documentCache.readAsync(
          repo,
          partyId as DocumentId,
        );

        if (!party) {
          continue;
        }

        const partyHandle = await client.findHandle<Party>(
          partyId as DocumentId,
        );

        partyHandle.change((doc: Party) => {
          const participantId =
            partyList.participantInParties[partyId as DocumentId];
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

  return {
    partyList,
    addPartyToList,
    removeParty,
    updateSettings,
    setLastOpenedPartyId,
  };
}
