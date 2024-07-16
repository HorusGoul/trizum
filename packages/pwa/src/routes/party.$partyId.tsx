import { isValidDocumentId, updateText } from "@automerge/automerge-repo/slim";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute } from "@tanstack/react-router";
import type { Party } from "#src/models/party.js";

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
});

function PartyById() {
  const { party } = useParty();

  if (party === undefined) {
    return <span>404 bruv</span>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">{party.name}</h1>
      </div>
    </div>
  );
}

function useParty() {
  const { partyId: _partyId } = Route.useParams();
  const partyId = isValidDocumentId(_partyId) ? _partyId : undefined;
  const [party, changeParty] = useDocument<Party>(partyId);
  function dispatch({ type, payload }: ChangePartyAction) {
    switch (type) {
      case "party_change_name":
        return changeParty((party) => {
          updateText(party, ["name"], payload.name);
        });
    }
  }
  return { party, partyId, dispatch };
}

interface ChangePartyNameAction {
  type: "party_change_name";
  payload: {
    name: string;
  };
}

type ChangePartyAction = ChangePartyNameAction;
