import type { Party } from "#src/models/party.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  isValidDocumentId,
  type AnyDocumentId,
} from "@automerge/automerge-repo/slim";
import { createFileRoute } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { t, Trans } from "@lingui/macro";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const parties = usePartyItemRefs();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">trizum</h1>

        <div className="flex-1" />

        <MenuTrigger>
          <IconButton icon="#lucide/ellipsis-vertical" aria-label={t`Menu`} />

          <Popover placement="bottom end">
            <Menu>
              <MenuItem
                href={{
                  to: "/settings",
                }}
              >
                <IconWithFallback
                  name="#lucide/settings"
                  size={20}
                  className="mr-3"
                />
                <span className="h-3.5 leading-none">
                  <Trans>Settings</Trans>
                </span>
              </MenuItem>
              <MenuItem
                href={{
                  to: "/about",
                }}
              >
                <IconWithFallback
                  name="#lucide/info"
                  size={20}
                  className="mr-3"
                />
                <span className="h-3.5 leading-none">
                  <Trans>About</Trans>
                </span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      <div className="h-2" />

      <div className="container flex flex-1 flex-col gap-4 px-2">
        {parties.map((partyId) => (
          <PartyItem key={partyId} partyId={partyId} />
        ))}

        <div className="flex-1" />

        <div className="sticky bottom-6 flex justify-end">
          <MenuTrigger>
            <IconButton
              aria-label={t`Add or create`}
              icon="#lucide/plus"
              color="accent"
              className="h-14 w-14 shadow-md"
            />

            <Popover placement="top end" offset={16}>
              <Menu className="min-w-60">
                <MenuItem href={{ to: "/join" }}>
                  <IconWithFallback
                    name="#lucide/ampersand"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Join a Party</Trans>
                  </span>
                </MenuItem>
                <MenuItem href={{ to: "/new" }}>
                  <IconWithFallback
                    name="#lucide/list-plus"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Create a new Party</Trans>
                  </span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </div>
  );
}

function usePartyItemRefs() {
  const repo = useRepo();
  const { partyList } = usePartyList();
  const refs = Object.keys(partyList.parties).filter(isValidDocumentId);

  for (const partyId of refs) {
    documentCache.prefetch(repo, partyId);
  }

  return refs;
}

function PartyItem({ partyId }: { partyId: AnyDocumentId }) {
  const [party, handle] = useSuspenseDocument<Party>(partyId);

  if (!party || handle.isDeleted()) {
    // not sure if this is the right way to handle NULL
    // or the isDeleted for list items, but this should work
    return null;
  }

  return (
    <Link
      href={{
        to: `/party/$partyId`,
        params: {
          partyId: party.id,
        },
      }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
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
  );
}
