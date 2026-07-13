import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import type { Party } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import { PartyListCard, type PartyListCardAction } from "#src/components/PartyListCard.tsx";
import { getOrderedPartySections, isPartyPinned } from "#src/lib/partyListOrdering.ts";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { MenuTrigger, Popover } from "react-aria-components";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { use } from "react";
import { toast } from "sonner";
import { UpdateContext } from "#src/components/UpdateContext.tsx";
import { showUpdateResultFeedback } from "#src/lib/updateResultFeedback.ts";
import { EmptyState } from "#src/routes/index/-components/EmptyState.js";
import { NoActivePartiesCard } from "#src/routes/index/-components/NoActivePartiesCard.js";
import { ProfileSetupCard } from "#src/routes/index/-components/ProfileSetupCard.js";

export const Route = createFileRoute("/_home")({
  component: Home,
});

function Home() {
  const { partyList, setPartyArchived, setPartyPinned } = usePartyList();
  const { activePartyIds, activeCount, archivedCount } = usePartySections(partyList);
  const { update, isUpdateAvailable, isUpdating, checkForUpdate } = use(UpdateContext);
  const location = useLocation();

  const showPartyHub = activeCount > 0 || archivedCount > 0;
  const needsProfileSetup = !partyList.username || partyList.username.trim() === "";
  const hasCloudSyncChild = location.pathname === "/settings/cloud-sync";

  return (
    <>
      <div
        aria-hidden={hasCloudSyncChild || undefined}
        inert={hasCloudSyncChild || undefined}
        className="flex min-h-full flex-col"
      >
        <div className="mt-safe container flex h-16 items-center pr-2">
          <h1 className="pl-4 text-2xl font-bold">trizum</h1>

          <span
            aria-label="Beta"
            className="text-accent-600 dark:text-accent-400 mb-4 ml-0.5 font-mono text-xs leading-none font-semibold"
          >
            βeta
          </span>

          <div className="flex-1" />

          {isUpdateAvailable ? (
            <IconButton
              icon="lucide.circle-arrow-down"
              aria-label={t`Update available`}
              pressAction={async () => {
                const result = await update();
                showUpdateResultFeedback(result);
              }}
              isPending={isUpdating}
              className="mr-2"
              iconClassName="animate-pulse duration-1000 ease-in-out"
            />
          ) : null}

          <MenuTrigger>
            <IconButton
              icon="lucide.circle-user-round"
              aria-label={t`Profile and app menu`}
              className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-200"
            />

            <Popover placement="bottom end">
              <Menu>
                <MenuItem href={{ to: "/settings" }}>
                  <Icon icon="lucide.settings" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Settings</Trans>
                  </span>
                </MenuItem>

                <MenuItem
                  href={{ to: "/settings/cloud-sync" }}
                  routerOptions={{ resetScroll: false }}
                >
                  <Icon icon="lucide.cloud" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>trizum cloud</Trans>
                  </span>
                </MenuItem>

                <MenuItem href={{ to: "/archived" }}>
                  <Icon icon="lucide.folder-archive" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Archived parties</Trans>
                  </span>
                </MenuItem>

                <MenuItem
                  onAction={() => {
                    checkForUpdate();
                  }}
                >
                  <Icon icon="lucide.refresh-cw" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Check for updates</Trans>
                  </span>
                </MenuItem>

                <MenuItem href={{ to: "/about" }}>
                  <Icon icon="lucide.info" width={20} height={20} className="mr-3" />
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
                      currentParticipantId={partyList.participantInParties[partyId] ?? null}
                    />
                  );
                })}
              </section>
            ) : (
              <NoActivePartiesCard />
            )}

            <div className="pb-safe-offset-12 flex-1" />

            <div className="bottom-safe-offset-6 sticky flex justify-end">
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
                      <Icon icon="lucide.ampersand" width={20} height={20} className="mr-3" />
                      <span className="h-3.5 leading-none">
                        <Trans>Join a Party</Trans>
                      </span>
                    </MenuItem>
                    <MenuItem href={{ to: "/new" }}>
                      <Icon icon="lucide.list-plus" width={20} height={20} className="mr-3" />
                      <span className="h-3.5 leading-none">
                        <Trans>Create a new Party</Trans>
                      </span>
                    </MenuItem>
                    <MenuItem href={{ to: "/migrate/tricount" }}>
                      <Icon icon="lucide.import" width={20} height={20} className="mr-3" />
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
      <Outlet />
    </>
  );
}

function usePartySections(partyList: PartyList) {
  const repo = useRepo();
  const sections = getOrderedPartySections(partyList);

  for (const partyId of [...sections.activePartyIds, ...sections.archivedPartyIds]) {
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
