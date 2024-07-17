import { usePartyList } from "#src/hooks/usePartyList.js";
import { EURO } from "#src/models/currency.js";
import type { Party } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/new")({
  component: New,
});

function New() {
  const repo = useRepo();
  const { addPartyToList } = usePartyList();
  const navigate = useNavigate();

  function onCreateParty() {
    const participants = [
      {
        id: crypto.randomUUID(),
        name: "Mario",
      },
      {
        id: crypto.randomUUID(),
        name: "Horus",
      },
    ];

    const handle = repo.create<Party>({
      id: "" as DocumentId,
      name: "Mario",
      description: "This is Mario's Party 1",
      currency: EURO,
      participants: participants.reduce<Party["participants"]>(
        (result, next) => {
          result[next.id] = {
            id: next.id,
            name: next.name,
          };
          return result;
        },
        {},
      ),
      expenses: [],
    });
    handle.change((doc) => (doc.id = handle.documentId));
    addPartyToList(handle.documentId);
    navigate({
      to: "/party/$partyId",
      params: { partyId: handle.documentId },
      replace: true,
    });

    return handle.documentId;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <IconButton icon="arrow-left" aria-label="Go Back" />

        <h1 className="pl-4 text-2xl font-bold">New trizum</h1>

        <div className="flex-1" />

        <IconButton icon="check" aria-label="Save" onPress={onCreateParty} />
      </div>
    </div>
  );
}
