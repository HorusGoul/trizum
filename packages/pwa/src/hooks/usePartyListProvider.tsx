import { useEffect, useState, type ReactNode } from "react";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  deleteAt,
  isValidDocumentId,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import { PartyListContext } from "./usePartyList";

export function PartyListProvider({ children }: { children: ReactNode }) {
  const repo = useRepo();
  const { partyList, changePartyList } = usePartyListValue();
  function addPartyToList(partyId: Party["id"]) {
    changePartyList((list) => {
      list.parties.push(partyId);
    });
  }
  function removeParty(partyId: Party["id"]) {
    repo.delete(partyId);
    changePartyList((list) => {
      const index = list.parties.findIndex((id) => id === partyId);
      if (index >= 0) {
        deleteAt(list.parties, index);
      }
    });
  }
  return (
    <PartyListContext.Provider
      value={{ partyList, changePartyList, addPartyToList, removeParty }}
    >
      {children}
    </PartyListContext.Provider>
  );
}

function usePartyListValue() {
  const repo = useRepo();
  const [partyListId, setPartyListId] = useState<DocumentId | undefined>();
  const [partyList, changePartyList] = useDocument<PartyList>(partyListId);

  useEffect(() => {
    const id = localStorage.getItem("partyListId");
    if (id && isValidDocumentId(id)) {
      setPartyListId(id);
    } else {
      const handle = repo.create<PartyList>({
        parties: [],
      });
      localStorage.setItem("partyListId", handle.documentId);
      setPartyListId(handle.documentId);
    }
  }, [repo]);

  return {
    partyList,
    changePartyList,
  };
}
