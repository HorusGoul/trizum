import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { Party } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import {
  isValidDocumentId,
  type AnyDocumentId,
} from "@automerge/automerge-repo/slim";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { usePartyList } from "#src/hooks/usePartyList.js";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import { use, useState } from "react";
import { UpdateContext } from "#src/components/UpdateContext.tsx";

let hasRedirectedThisSession = false;

export const Route = createFileRoute("/")({
  component: Index,
  beforeLoad: async ({ context }) => {
    // Only redirect once per session (on app launch)
    if (hasRedirectedThisSession) {
      return;
    }

    const partyListId = localStorage.getItem("partyListId");
    if (!partyListId || !isValidDocumentId(partyListId)) {
      return;
    }

    const partyList = (await documentCache.readAsync(
      context.repo,
      partyListId,
    )) as PartyList | undefined;

    if (!partyList) {
      return;
    }

    const { openLastPartyOnLaunch, lastOpenedPartyId, parties } = partyList;

    if (
      openLastPartyOnLaunch &&
      lastOpenedPartyId &&
      isValidDocumentId(lastOpenedPartyId) &&
      parties[lastOpenedPartyId]
    ) {
      hasRedirectedThisSession = true;
      throw redirect({
        to: "/party/$partyId",
        params: { partyId: lastOpenedPartyId },
        search: { tab: "expenses" },
        replace: true,
      });
    }
  },
});

function Index() {
  const parties = usePartyItemRefs();
  const { partyList } = usePartyList();
  const { update, isUpdateAvailable, checkForUpdate } = use(UpdateContext);
  const [isUpdating, setIsUpdating] = useState(false);

  const showList = parties.length > 0;
  const needsProfileSetup =
    !partyList.username || partyList.username.trim() === "";

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2 mt-safe">
        <h1 className="pl-4 text-2xl font-bold">trizum</h1>

        <span
          aria-label="Beta"
          className="mb-4 ml-0.5 font-mono text-xs font-semibold leading-none text-accent-600 dark:text-accent-400"
        >
          βeta
        </span>

        <div className="flex-1" />

        {isUpdateAvailable && (
          <IconButton
            icon={
              isUpdating ? "#lucide/refresh-cw" : "#lucide/circle-arrow-down"
            }
            aria-label={t`Update available`}
            onPress={() => {
              setIsUpdating(true);
              update();
            }}
            className="mr-2"
            iconClassName={cn(
              "duration-1000 ease-in-out",
              isUpdating ? "animate-spin" : "animate-pulse",
            )}
            isDisabled={isUpdating}
          />
        )}

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
                onAction={() => {
                  checkForUpdate();
                }}
              >
                <IconWithFallback
                  name="#lucide/refresh-cw"
                  size={20}
                  className="mr-3"
                />
                <span className="h-3.5 leading-none">
                  <Trans>Check for updates</Trans>
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

      {showList ? (
        <div className="container flex flex-1 flex-col gap-4 px-2">
          {needsProfileSetup && <ProfileSetupCard />}

          {parties.map((partyId) => (
            <PartyItem key={partyId} partyId={partyId} />
          ))}

          <div className="flex-1 pb-safe-offset-12" />

          <div className="sticky flex justify-end bottom-safe-offset-6">
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
                  <MenuItem href={{ to: "/migrate/tricount" }}>
                    <IconWithFallback
                      name="#lucide/import"
                      size={20}
                      className="mr-3"
                    />
                    <span className="h-3.5 leading-none">
                      <Trans>Migrate from Tricount</Trans>
                    </span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
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

  if (!party || !handle) {
    return null;
  }

  const activeParticipants = Object.values(party.participants).filter(
    (participant) => !participant.isArchived,
  );
  const participantCount = activeParticipants.length;
  const symbolOrFirstLetter =
    party.symbol || party.name.charAt(0).toUpperCase();

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
          "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
          isPressed &&
            "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
        )
      }
    >
      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-950 text-sm font-semibold text-white">
        <span className="pt-0.5">{symbolOrFirstLetter}</span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-lg font-semibold leading-tight text-accent-950 dark:text-accent-50">
          {party.name}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-accent-500 dark:text-accent-500">
          {participantCount}{" "}
          {participantCount === 1 ? (
            <Trans>participant</Trans>
          ) : (
            <Trans>participants</Trans>
          )}
        </span>
        {party.description && (
          <span className="text-sm text-accent-600 dark:text-accent-400">
            {party.description}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-bold">
          <Trans>Welcome to trizum</Trans>
        </h1>
        <p className="text-lg text-accent-700 dark:text-accent-300">
          <Trans>
            Split bills with friends and family. Track expenses, calculate
            balances, and settle up together.
          </Trans>
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        <Link
          href={{ to: "/new" }}
          className={({
            isPressed,
            isFocusVisible,
            isHovered,
            defaultClassName,
          }) =>
            cn(
              defaultClassName,
              "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
              (isHovered || isFocusVisible) &&
                "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
              isPressed &&
                "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
            )
          }
        >
          <IconWithFallback
            name="#lucide/list-plus"
            size={24}
            className="text-accent-600 dark:text-accent-400"
          />
          <div className="flex flex-1 flex-col">
            <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">
              <Trans>Create a new Party</Trans>
            </span>
            <span className="text-sm text-accent-600 dark:text-accent-400">
              <Trans>Start tracking expenses with your group</Trans>
            </span>
          </div>
        </Link>

        <Link
          href={{ to: "/join" }}
          className={({
            isPressed,
            isFocusVisible,
            isHovered,
            defaultClassName,
          }) =>
            cn(
              defaultClassName,
              "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
              (isHovered || isFocusVisible) &&
                "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
              isPressed &&
                "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
            )
          }
        >
          <IconWithFallback
            name="#lucide/ampersand"
            size={24}
            className="text-accent-600 dark:text-accent-400"
          />
          <div className="flex flex-1 flex-col">
            <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">
              <Trans>Join a Party</Trans>
            </span>
            <span className="text-sm text-accent-600 dark:text-accent-400">
              <Trans>Enter a party link or code to join</Trans>
            </span>
          </div>
        </Link>

        <Link
          href={{ to: "/migrate/tricount" }}
          className={({
            isPressed,
            isFocusVisible,
            isHovered,
            defaultClassName,
          }) =>
            cn(
              defaultClassName,
              "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
              (isHovered || isFocusVisible) &&
                "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
              isPressed &&
                "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
            )
          }
        >
          <IconWithFallback
            name="#lucide/import"
            size={24}
            className="text-accent-600 dark:text-accent-400"
          />
          <div className="flex flex-1 flex-col">
            <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">
              <Trans>Migrate from Tricount</Trans>
            </span>
            <span className="text-sm text-accent-600 dark:text-accent-400">
              <Trans>Import your existing Tricount data</Trans>
            </span>
          </div>
        </Link>

        <Link
          href={{ to: "/settings" }}
          className={({
            isPressed,
            isFocusVisible,
            isHovered,
            defaultClassName,
          }) =>
            cn(
              defaultClassName,
              "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
              (isHovered || isFocusVisible) &&
                "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
              isPressed &&
                "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
            )
          }
        >
          <IconWithFallback
            name="#lucide/user"
            size={24}
            className="text-accent-600 dark:text-accent-400"
          />
          <div className="flex flex-1 flex-col">
            <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">
              <Trans>Configure Profile</Trans>
            </span>
            <span className="text-sm text-accent-600 dark:text-accent-400">
              <Trans>Set up your username, avatar, and preferences</Trans>
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function ProfileSetupCard() {
  return (
    <Link
      href={{ to: "/settings" }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex scale-100 items-start gap-4 rounded-xl border border-accent-400 bg-accent-50 p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-500 dark:bg-accent-950",
          (isHovered || isFocusVisible) &&
            "border-accent-500 shadow-md dark:border-accent-400 dark:bg-accent-900 dark:shadow-none",
          isPressed &&
            "scale-95 border-accent-600 bg-opacity-90 shadow-lg dark:border-accent-300 dark:bg-accent-800 dark:shadow-none",
        )
      }
    >
      <div className="-mt-0.5 flex h-8 w-8 flex-shrink-0 justify-center">
        <IconWithFallback
          name="#lucide/user-round-pen"
          className="text-accent-600 dark:text-accent-400"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-lg font-semibold leading-tight text-accent-950 dark:text-accent-50">
          <Trans>Complete your profile</Trans>
        </span>
        <span className="text-sm text-accent-600 dark:text-accent-400">
          <Trans>
            Add your name so others know who you are and how to pay you
          </Trans>
        </span>
      </div>
    </Link>
  );
}
