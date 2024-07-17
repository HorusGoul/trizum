import { isValidDocumentId, updateText } from "@automerge/automerge-repo/slim";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Party } from "#src/models/party.js";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
});

function PartyById() {
  const { party, partyId } = useParty();
  const { removeParty } = usePartyList();
  const navigate = useNavigate();

  function onDeleteParty() {
    if (!partyId) return;
    removeParty(partyId);
    navigate({ to: "/", replace: true });
  }

  if (party === undefined) {
    return <span>404 bruv</span>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">{party.name}</h1>
        <div className="flex-1" />
        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu>
              <MenuItem onAction={onDeleteParty}>
                <IconWithFallback name="trash" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Delete</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
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
