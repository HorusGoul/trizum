import { EURO } from "#src/models/currency.js";
import type { Party } from "#src/models/party.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  isValidDocumentId,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { loadDocumentsByIds } from "#src/lib/automerge";
import { usePartyList } from "#src/hooks/usePartyList.js";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const repo = useRepo();
  const { parties, addPartyToList } = useParties();

  function onCreateParty() {
    const handle = repo.create<Party>({
      id: "" as DocumentId,
      name: "Mario",
      description: "This is Mario's Party 1",
      currency: EURO,
      participants: ["Mario", "Horus"],
      expenses: [],
    });
    handle.change((doc) => (doc.id = handle.documentId));
    addPartyToList(handle.documentId);
    return handle.documentId;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">trizum</h1>

        <div className="flex-1" />

        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />

          <Popover placement="bottom end">
            <Menu>
              <MenuItem
                href={{
                  to: "/settings",
                }}
              >
                <IconWithFallback name="settings" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Settings</span>
              </MenuItem>
              <MenuItem
                href={{
                  to: "/about",
                }}
              >
                <IconWithFallback name="info" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">About</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      <div className="h-2" />

      <div className="container flex flex-1 flex-col gap-4 px-2">
        {parties.map((party) => (
          <Link
            key={party.id}
            href={{
              to: `/party/$partyId`,
              params: {
                partyId: party.id,
              },
            }}
            className={({
              isPressed,
              isFocusVisible,
              isHovered,
              defaultClassName,
            }) =>
              cn(
                defaultClassName,
                "flex w-full scale-100 flex-col rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-slate-900",
                (isHovered || isFocusVisible) &&
                  "shadow-md dark:bg-slate-800 dark:shadow-none",
                isPressed &&
                  "scale-105 bg-opacity-90 shadow-lg dark:bg-slate-700 dark:shadow-none",
              )
            }
          >
            <span className="text-xl font-medium">{party.name}</span>
            <span className="text-lg">{party.description}</span>
          </Link>
        ))}

        <div className="flex-1" />

        <div className="sticky bottom-6 flex justify-end">
          <MenuTrigger>
            <IconButton
              aria-label="Add or create"
              icon="plus"
              color="accent"
              className="h-14 w-14 shadow-md"
            />

            <Popover placement="top end" offset={16}>
              <Menu className="min-w-60">
                <MenuItem href={{ to: "/join" }}>
                  <IconWithFallback
                    name="ampersand"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">Join a Party</span>
                </MenuItem>
                <MenuItem onAction={onCreateParty}>
                  <IconWithFallback
                    name="list-plus"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">Create a new Party</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </div>
  );
}

function useParties() {
  const repo = useRepo();
  const [parties, setParties] = useState<Party[]>([]);
  const { partyList, addPartyToList, removeParty } = usePartyList();

  useEffect(() => {
    const ids = Object.keys(partyList?.parties ?? {}).filter(isValidDocumentId);
    loadDocumentsByIds<Party>(repo, ids).then(setParties);
  }, [partyList, repo]);

  return { parties, addPartyToList, removeParty };
}
