import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { PartyList } from "#src/models/partyList.js";
import { PartyListCard } from "#src/components/PartyListCard.tsx";
import {
  getOrderedPartySections,
  isPartyPinned,
} from "#src/lib/partyListOrdering.ts";
import { IconWithFallback, type IconProps } from "#src/ui/Icon.js";
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
  const { activePartyIds, activeCount, archivedCount, pinnedActiveCount } =
    usePartySections(partyList);
  const { update, isUpdateAvailable, checkForUpdate } = use(UpdateContext);
  const [isUpdating, setIsUpdating] = useState(false);

  const showPartyHub = activeCount > 0 || archivedCount > 0;
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

        {isUpdateAvailable ? (
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
        ) : null}

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
                  to: "/archived",
                }}
              >
                <IconWithFallback
                  name="#lucide/folder-archive"
                  size={20}
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

      {showPartyHub ? (
        <div className="container flex flex-1 flex-col gap-4 px-2">
          <HomeOverviewCard
            activeCount={activeCount}
            archivedCount={archivedCount}
            pinnedCount={pinnedActiveCount}
          />

          {needsProfileSetup ? <ProfileSetupCard /> : null}

          {activeCount > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="px-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-600 dark:text-accent-300">
                  <Trans>Your parties</Trans>
                </h2>
                <p className="mt-1 text-sm text-accent-700 dark:text-accent-300">
                  <Trans>
                    Pinned parties stay on top, then the rest follow your latest
                    activity.
                  </Trans>
                </p>
              </div>

              {activePartyIds.map((partyId) => {
                const pinned = isPartyPinned(partyList, partyId);

                return (
                  <PartyListCard
                    key={partyId}
                    partyId={partyId}
                    isPinned={pinned}
                    lastUsedAt={partyList.lastUsedAt?.[partyId] ?? null}
                    renderMenu={(party) => (
                      <MenuTrigger>
                        <IconButton
                          icon="#lucide/ellipsis-vertical"
                          aria-label={t`Party actions`}
                          color="input-like"
                          className="h-10 w-10 flex-shrink-0"
                        />

                        <Popover placement="bottom end">
                          <Menu className="min-w-60">
                            <MenuItem
                              onAction={() => {
                                setPartyPinned(party.id, !pinned);
                                toast.success(
                                  pinned ? t`Party unpinned` : t`Party pinned`,
                                );
                              }}
                            >
                              <IconWithFallback
                                name={
                                  pinned ? "#lucide/pin-off" : "#lucide/pin"
                                }
                                size={20}
                                className="mr-3"
                              />
                              <span className="h-3.5 leading-none">
                                {pinned ? (
                                  <Trans>Unpin party</Trans>
                                ) : (
                                  <Trans>Pin party</Trans>
                                )}
                              </span>
                            </MenuItem>

                            <MenuItem
                              onAction={() => {
                                setPartyArchived(party.id, true);
                                toast.success(t`Party archived`);
                              }}
                            >
                              <IconWithFallback
                                name="#lucide/archive"
                                size={20}
                                className="mr-3"
                              />
                              <span className="h-3.5 leading-none">
                                <Trans>Archive party</Trans>
                              </span>
                            </MenuItem>
                          </Menu>
                        </Popover>
                      </MenuTrigger>
                    )}
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

function HomeOverviewCard({
  activeCount,
  archivedCount,
  pinnedCount,
}: {
  activeCount: number;
  archivedCount: number;
  pinnedCount: number;
}) {
  return (
    <section className="rounded-[1.9rem] border border-accent-300/80 bg-gradient-to-br from-accent-500 via-accent-600 to-accent-700 p-5 text-accent-50 shadow-sm dark:border-accent-500/60 dark:from-accent-700 dark:via-accent-800 dark:to-accent-950 dark:shadow-none">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-lg">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-50/75">
            <Trans>Home</Trans>
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-accent-50">
            <Trans>Jump back into the groups you use most</Trans>
          </h2>
          <p className="mt-2 text-sm text-accent-50/80">
            <Trans>
              Pinned parties stay close. Recent activity keeps the rest in
              order.
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
              "inline-flex items-center gap-3 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-accent-50 shadow-sm outline-none backdrop-blur-sm transition-all duration-200 ease-in-out dark:bg-accent-950/30 dark:shadow-none",
              (isHovered || isFocusVisible) &&
                "bg-white/18 dark:bg-accent-950/45",
              isPressed && "bg-white/22 scale-95 dark:bg-accent-950/55",
            )
          }
        >
          <IconWithFallback name="#lucide/folder-archive" size={16} />
          <span>
            <Trans>Open archived parties</Trans>
          </span>
          <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-50">
            {archivedCount}
          </span>
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <HomeMetric
          icon="#lucide/layout-list"
          value={activeCount}
          label={t`Active`}
        />
        <HomeMetric icon="#lucide/pin" value={pinnedCount} label={t`Pinned`} />
        <HomeMetric
          icon="#lucide/archive"
          value={archivedCount}
          label={t`Archived`}
        />
      </div>
    </section>
  );
}

function HomeMetric({
  icon,
  value,
  label,
}: {
  icon: IconProps["name"];
  value: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-accent-50 shadow-sm backdrop-blur-sm dark:bg-accent-950/30 dark:shadow-none">
      <div className="bg-white/12 rounded-full p-2 text-accent-50">
        <IconWithFallback name={icon} size={14} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-50/70">
          {label}
        </span>
      </div>
    </div>
  );
}

function NoActivePartiesCard() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-accent-300 bg-white/80 p-6 shadow-sm dark:border-accent-700 dark:bg-accent-950/70 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-accent-100 p-3 text-accent-700 dark:bg-accent-800 dark:text-accent-200">
            <IconWithFallback name="#lucide/folder-archive" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-accent-950 dark:text-accent-50">
              <Trans>No active parties right now</Trans>
            </h2>
            <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">
              <Trans>
                Everything is archived for now. You can reopen any party from
                the archived screen whenever you need it.
              </Trans>
            </p>
          </div>
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
              (isHovered || isFocusVisible) &&
                "bg-accent-600 dark:bg-accent-400",
              isPressed && "scale-95 bg-accent-700 dark:bg-accent-300",
            )
          }
        >
          <Trans>Open archived parties</Trans>
        </Link>
      </div>
    </div>
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
