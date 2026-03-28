import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { PartyListCard } from "#src/components/PartyListCard.tsx";
import { usePartyList } from "#src/hooks/usePartyList.js";
import type { PartyList } from "#src/models/partyList.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import {
  getOrderedPartySections,
  isPartyPinned,
} from "#src/lib/partyListOrdering.ts";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";

export const Route = createFileRoute("/archived")({
  component: ArchivedParties,
});

function ArchivedParties() {
  const { partyList, setPartyArchived, setPartyPinned } = usePartyList();
  const archivedPartyIds = useArchivedPartyIds(partyList);

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Archived Parties</Trans>
        </h1>
      </div>

      <div className="container mt-4 flex flex-1 flex-col gap-4 px-2 pb-safe-offset-8">
        <section className="rounded-[1.75rem] border border-accent-200/80 bg-white/90 p-5 shadow-sm dark:border-accent-800 dark:bg-accent-950/70 dark:shadow-none">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-600 dark:text-accent-300">
                <Trans>Archive</Trans>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-accent-950 dark:text-accent-50">
                <Trans>Older parties stay tucked away, not gone</Trans>
              </h2>
              <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">
                <Trans>
                  Archived parties live here until you restore them to the home
                  screen.
                </Trans>
              </p>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-full bg-accent-100 px-4 py-2 text-accent-800 dark:bg-accent-800 dark:text-accent-100">
              <IconWithFallback name="#lucide/folder-archive" size={16} />
              <span className="text-sm font-semibold">
                {archivedPartyIds.length}
              </span>
            </div>
          </div>
        </section>

        {archivedPartyIds.length > 0 ? (
          archivedPartyIds.map((partyId) => {
            const pinned = isPartyPinned(partyList, partyId);

            return (
              <PartyListCard
                key={partyId}
                partyId={partyId}
                isArchived={true}
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
                            setPartyArchived(party.id, false);
                            toast.success(t`Party restored to home`);
                          }}
                        >
                          <IconWithFallback
                            name="#lucide/archive-restore"
                            size={20}
                            className="mr-3"
                          />
                          <span className="h-3.5 leading-none">
                            <Trans>Restore to home</Trans>
                          </span>
                        </MenuItem>

                        <MenuItem
                          onAction={() => {
                            setPartyPinned(party.id, !pinned);
                            toast.success(
                              pinned ? t`Party unpinned` : t`Party pinned`,
                            );
                          }}
                        >
                          <IconWithFallback
                            name={pinned ? "#lucide/pin-off" : "#lucide/pin"}
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
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                )}
              />
            );
          })
        ) : (
          <ArchivedEmptyState />
        )}
      </div>
    </div>
  );
}

function useArchivedPartyIds(partyList: PartyList) {
  const repo = useRepo();
  const { archivedPartyIds } = getOrderedPartySections(partyList);

  for (const partyId of archivedPartyIds) {
    documentCache.prefetch(repo, partyId);
  }

  return archivedPartyIds;
}

function ArchivedEmptyState() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-accent-300 bg-white/80 p-6 text-center shadow-sm dark:border-accent-700 dark:bg-accent-950/70 dark:shadow-none">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="rounded-full bg-accent-100 p-4 text-accent-700 dark:bg-accent-800 dark:text-accent-200">
          <IconWithFallback name="#lucide/archive-restore" size={22} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-accent-950 dark:text-accent-50">
            <Trans>No archived parties</Trans>
          </h2>
          <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">
            <Trans>
              Archive a party from the home screen when you want to clear some
              space without losing it.
            </Trans>
          </p>
        </div>

        <Link
          href={{ to: "/" }}
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
          <Trans>Back to home</Trans>
        </Link>
      </div>
    </div>
  );
}
