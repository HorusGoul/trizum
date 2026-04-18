import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { PartyList } from "#src/models/partyList.js";
import type { Party } from "#src/models/party.js";
import {
  PartyListCard,
  type PartyListCardAction,
} from "#src/components/PartyListCard.tsx";
import {
  getOrderedPartySections,
  isPartyPinned,
} from "#src/lib/partyListOrdering.ts";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { use, useState } from "react";
import { toast } from "sonner";
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
      parties[lastOpenedPartyId] &&
      partyList.archivedParties?.[lastOpenedPartyId] !== true
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
  const { partyList, setPartyArchived, setPartyPinned } = usePartyList();
  const { activePartyIds, activeCount, archivedCount } =
    usePartySections(partyList);
  const { update, isUpdateAvailable, checkForUpdate } = use(UpdateContext);
  const [isUpdating, setIsUpdating] = useState(false);

  const showPartyHub = activeCount > 0 || archivedCount > 0;
  const needsProfileSetup =
    !partyList.username || partyList.username.trim() === "";

  return (
    <>
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

          {isUpdateAvailable ? (
            <IconButton
              icon={
                isUpdating ? "lucide.refresh-cw" : "lucide.circle-arrow-down"
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
          ) : null}

          <MenuTrigger>
            <IconButton icon="lucide.ellipsis-vertical" aria-label={t`Menu`} />

            <Popover placement="bottom end">
              <Menu>
                <MenuItem
                  href={{
                    to: "/settings",
                  }}
                >
                  <Icon
                    icon="lucide.settings"
                    width={20}
                    height={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Settings</Trans>
                  </span>
                </MenuItem>

                <MenuItem
                  href={{
                    to: "/archived",
                  }}
                >
                  <Icon
                    icon="lucide.folder-archive"
                    width={20}
                    height={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Archived parties</Trans>
                  </span>
                </MenuItem>

                <MenuItem
                  onAction={() => {
                    checkForUpdate();
                  }}
                >
                  <Icon
                    icon="lucide.refresh-cw"
                    width={20}
                    height={20}
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
                  <Icon
                    icon="lucide.info"
                    width={20}
                    height={20}
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

        {showPartyHub ? (
          <div className="container flex flex-1 flex-col gap-4 px-2">
            {needsProfileSetup ? <ProfileSetupCard /> : null}

            {activeCount > 0 ? (
              <section className="flex flex-col gap-3">
                {activePartyIds.map((partyId) => {
                  const pinned = isPartyPinned(partyList, partyId);
                  const actions = createPartyActions({
                    isPinned: pinned,
                    onTogglePinned: () => {
                      togglePartyPinned(partyList, partyId, setPartyPinned);
                    },
                    onArchive: () => {
                      archiveParty(partyId, setPartyArchived);
                    },
                  });

                  return (
                    <PartyListCard
                      key={partyId}
                      actions={actions}
                      partyId={partyId}
                      isPinned={pinned}
                      currentParticipantId={
                        partyList.participantInParties[partyId] ?? null
                      }
                    />
                  );
                })}
              </section>
            ) : (
              <NoActivePartiesCard />
            )}

            <div className="flex-1 pb-safe-offset-12" />

            <div className="sticky flex justify-end bottom-safe-offset-6">
              <MenuTrigger>
                <IconButton
                  aria-label={t`Add or create`}
                  icon="lucide.plus"
                  color="accent"
                  className="h-14 w-14 shadow-md"
                />

                <Popover placement="top end" offset={16}>
                  <Menu className="min-w-60">
                    <MenuItem href={{ to: "/join" }}>
                      <Icon
                        icon="lucide.ampersand"
                        width={20}
                        height={20}
                        className="mr-3"
                      />
                      <span className="h-3.5 leading-none">
                        <Trans>Join a Party</Trans>
                      </span>
                    </MenuItem>
                    <MenuItem href={{ to: "/new" }}>
                      <Icon
                        icon="lucide.list-plus"
                        width={20}
                        height={20}
                        className="mr-3"
                      />
                      <span className="h-3.5 leading-none">
                        <Trans>Create a new Party</Trans>
                      </span>
                    </MenuItem>
                    <MenuItem href={{ to: "/migrate/tricount" }}>
                      <Icon
                        icon="lucide.import"
                        width={20}
                        height={20}
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
    </>
  );
}

function usePartySections(partyList: PartyList) {
  const repo = useRepo();
  const sections = getOrderedPartySections(partyList);

  for (const partyId of [
    ...sections.activePartyIds,
    ...sections.archivedPartyIds,
  ]) {
    documentCache.prefetch(repo, partyId);
  }

  return sections;
}

function createPartyActions({
  isPinned,
  onTogglePinned,
  onArchive,
}: {
  isPinned: boolean;
  onTogglePinned: () => void;
  onArchive: () => void;
}): PartyListCardAction[] {
  return [
    {
      key: "pin",
      icon: isPinned ? "lucide.pin-off" : "lucide.pin",
      label: isPinned ? <Trans>Unpin party</Trans> : <Trans>Pin party</Trans>,
      onAction: onTogglePinned,
    },
    {
      key: "archive",
      icon: "lucide.archive",
      label: <Trans>Archive party</Trans>,
      onAction: onArchive,
    },
  ];
}

function togglePartyPinned(
  partyList: PartyList,
  partyId: Party["id"],
  setPartyPinned: ReturnType<typeof usePartyList>["setPartyPinned"],
) {
  const currentlyPinned = isPartyPinned(partyList, partyId);
  setPartyPinned(partyId, !currentlyPinned);
  toast.success(currentlyPinned ? t`Party unpinned` : t`Party pinned`);
}

function archiveParty(
  partyId: Party["id"],
  setPartyArchived: ReturnType<typeof usePartyList>["setPartyArchived"],
) {
  setPartyArchived(partyId, true);
  toast.success(t`Party archived`);
}

function NoActivePartiesCard() {
  return (
    <section className="flex flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <div className="rounded-full bg-accent-100 p-4 text-accent-700 dark:bg-accent-800 dark:text-accent-200">
        <Icon icon="lucide.folder-archive" width={22} height={22} />
      </div>

      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-accent-950 dark:text-accent-50">
          <Trans>No active parties right now</Trans>
        </h2>
        <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">
          <Trans>
            Everything is archived for now. You can reopen any party from the
            archived screen whenever you need it.
          </Trans>
        </p>
      </div>

      <Link
        href={{ to: "/archived" }}
        className={({
          isPressed,
          isFocusVisible,
          isHovered,
          defaultClassName,
        }) =>
          cn(
            defaultClassName,
            "inline-flex items-center justify-center rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-50 outline-none transition-all duration-200 ease-in-out dark:bg-accent-500",
            (isHovered || isFocusVisible) && "bg-accent-600 dark:bg-accent-400",
            isPressed && "scale-95 bg-accent-700 dark:bg-accent-300",
          )
        }
      >
        <Trans>Open archived parties</Trans>
      </Link>
    </section>
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
          <Icon
            icon="lucide.list-plus"
            width={24}
            height={24}
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
          <Icon
            icon="lucide.ampersand"
            width={24}
            height={24}
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
          <Icon
            icon="lucide.import"
            width={24}
            height={24}
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
          <Icon
            icon="lucide.user"
            width={24}
            height={24}
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
        <Icon
          icon="lucide.user-round-pen"
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
