import { useState } from "react";
import { getPartyListId, type PartyList } from "#src/models/partyList.js";
import { type DocumentId } from "@automerge/automerge-repo/slim";
import type { Party, PartyParticipant } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";

export function usePartyList() {
  const repo = useRepo();
  const [partyListId] = useState<DocumentId>(() => getPartyListId(repo));
  const [partyList, partyListHandle] = useSuspenseDocument<PartyList>(
    partyListId,
    {
      required: true,
    },
  );

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
    repo.delete(partyId);
    partyListHandle.change((list) => {
      delete list.parties[partyId];

      if (!list.participantInParties) {
        return;
      }

      delete list.participantInParties[partyId];
    });
  }

  function updateSettings(values: Pick<PartyList, "username" | "phone">) {
    partyListHandle.change((list) => {
      list.username = values.username;
      list.phone = values.phone;
    });
  }

  return {
    partyList,
    changePartyList: partyListHandle.change,
    addPartyToList,
    removeParty,
    updateSettings,
  };
}
