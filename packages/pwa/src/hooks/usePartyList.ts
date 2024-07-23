import { useState } from "react";
import type { PartyList } from "#src/models/partyList.js";
import {
  isValidDocumentId,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";

export function usePartyList() {
  const repo = useRepo();
  const [partyListId] = useState<DocumentId>(() => {
    const id = localStorage.getItem("partyListId");

    if (id && isValidDocumentId(id)) {
      return id;
    }

    const handle = repo.create<PartyList>({
      parties: {},
    });

    localStorage.setItem("partyListId", handle.documentId);
    return handle.documentId;
  });
  const [partyList, partyListHandle] = useSuspenseDocument<PartyList>(
    partyListId,
    {
      required: true,
    },
  );

  function addPartyToList(partyId: Party["id"]) {
    partyListHandle.change((list) => {
      list.parties[partyId] = true;
    });
  }
  function removeParty(partyId: Party["id"]) {
    repo.delete(partyId);
    partyListHandle.change((list) => {
      delete list.parties[partyId];
    });
  }

  return {
    partyList,
    changePartyList: partyListHandle.change,
    addPartyToList,
    removeParty,
  };
}
