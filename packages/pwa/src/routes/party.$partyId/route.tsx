import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { Icon } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { BackButton } from "#src/components/BackButton.js";
import { cn } from "#src/ui/utils.js";
import { toast } from "sonner";
import { useParty } from "#src/hooks/useParty.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { AnimatedTabs } from "#src/ui/AnimatedTabs.js";
import { Suspense, useEffect, useRef, type Key } from "react";
import { Switch } from "#src/ui/Switch.tsx";
import { useBalancesSortedBy } from "#src/hooks/useBalancesSortBy.ts";
import { loadVisiblePartyExpenseChunks } from "#src/lib/partyPaginatedExpenses.ts";
import { Balances } from "./-components/Balances.js";
import { ExpenseLog } from "./-components/ExpenseLog.js";

interface PartyByIdSearchParams {
  tab: "expenses" | "balances";
}

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params: { partyId }, location }) => {
    const { party } = await guardParticipatingInParty(partyId, context, location);

    await loadVisiblePartyExpenseChunks(
      context.repo,
      party.chunkRefs.map((chunkRef) => chunkRef.chunkId),
    );

    return;
  },
  validateSearch: (search): PartyByIdSearchParams => {
    const tab = search.tab === "balances" ? "balances" : "expenses";

    return { tab };
  },
});

function PartyById() {
  const params = Route.useParams();
  const { tab: selectedTab } = Route.useSearch();
  const { party, partyId, isLoading, setParticipantDetails, recalculateBalances } = useParty(
    params.partyId,
  );
  const { removeParty } = usePartyList();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();
  const balancesTabPanelRef = useRef<HTMLDivElement>(null);
  const [balancesSortedBy, setBalancesSortedBy] = useBalancesSortedBy();

  function selectedTabChangeAction(tab: Key) {
    return navigate({
      to: "/party/$partyId",
      params: { partyId },
      search: { tab: tab as "expenses" | "balances" },
      replace: true,
    });
  }

  const { setLastOpenedPartyId } = usePartyList();
  const lastRecordedPartyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!partyId || lastRecordedPartyIdRef.current === partyId) {
      return;
    }

    lastRecordedPartyIdRef.current = partyId;
    setLastOpenedPartyId(partyId);
  }, [partyId, setLastOpenedPartyId]);

  async function onLeaveParty() {
    if (!partyId) return;
    await navigate({ to: "/", replace: true });
    removeParty(partyId);
    toast.success(t`You left the party!`);
  }

  if (partyId === undefined) {
    return <span>Invalid Party ID</span>;
  }

  if (isLoading) {
    return null;
  }

  if (party === undefined) {
    return <span>404 bruv</span>;
  }

  const participantName = participant.name;

  function onTogglePersonalMode() {
    setParticipantDetails(participant.id, {
      personalMode: !participant.personalMode,
    });
  }

  return (
    <div className="flex h-full max-h-full flex-col">
      <div className="container flex h-16 flex-shrink-0 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          {[party.symbol, party.name].filter((v) => !!v).join(" ")}
        </h1>
        <div className="flex-1" />
        {selectedTab === "balances" ? (
          <MenuTrigger>
            <IconButton
              icon="lucide.arrow-up-down"
              aria-label={t`Sort balances`}
              className="flex-shrink-0"
            />
            <Popover placement="bottom end">
              <Menu className="min-w-60">
                <MenuItem onAction={() => setBalancesSortedBy("name")}>
                  <Icon icon="lucide.arrow-down-a-z" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Name</Trans>
                  </span>
                  <div className="flex-1" />
                  {balancesSortedBy === "name" ? (
                    <Icon icon="lucide.check" className="ml-3" />
                  ) : null}
                </MenuItem>

                <MenuItem onAction={() => setBalancesSortedBy("balance-ascending")}>
                  <Icon
                    icon="lucide.arrow-down-narrow-wide"
                    width={20}
                    height={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Balance, Lowest First</Trans>
                  </span>
                  <div className="flex-1" />
                  {balancesSortedBy === "balance-ascending" ? (
                    <Icon icon="lucide.check" className="ml-3" />
                  ) : null}
                </MenuItem>

                <MenuItem onAction={() => setBalancesSortedBy("balance-descending")}>
                  <Icon
                    icon="lucide.arrow-up-narrow-wide"
                    width={20}
                    height={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Balance, Highest First</Trans>
                  </span>
                  <div className="flex-1" />
                  {balancesSortedBy === "balance-descending" ? (
                    <Icon icon="lucide.check" className="ml-3" />
                  ) : null}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : null}
        <MenuTrigger>
          <IconButton
            icon="lucide.ellipsis-vertical"
            aria-label={t`Menu`}
            className="flex-shrink-0"
          />
          <Popover placement="bottom end">
            <Menu className="min-w-60">
              <MenuItem
                href={{
                  to: "/party/$partyId/who",
                  params: { partyId },
                }}
              >
                <Icon
                  icon="lucide.user-round-pen"
                  width={20}
                  height={20}
                  className="mr-3 self-start"
                />
                <div className="flex flex-col">
                  <span className="leading-none">
                    <Trans>Viewing as {participantName}</Trans>
                  </span>

                  <span className="mt-2 text-sm leading-none opacity-80">
                    <Trans>Tap to change</Trans>
                  </span>
                </div>
              </MenuItem>

              <MenuItem onAction={onTogglePersonalMode}>
                <Icon
                  icon="lucide.user-round-check"
                  width={20}
                  height={20}
                  className="mr-3 self-start"
                />
                <div className="mr-3 flex flex-col">
                  <span className="leading-none">
                    <Trans>Personal mode</Trans>
                  </span>

                  <span className="mt-2 text-sm leading-none opacity-80">
                    <Trans>Only show your expenses</Trans>
                  </span>
                </div>
                <Switch
                  isSelected={participant.personalMode ?? false}
                  onChange={onTogglePersonalMode}
                  isReadOnly={true}
                />
              </MenuItem>

              <MenuItem
                href={{
                  to: "/party/$partyId/stats",
                  params: { partyId },
                }}
              >
                <Icon icon="lucide.users" width={20} height={20} className="mr-3 self-start" />
                <div className="flex flex-col">
                  <span className="leading-none">
                    <Trans>Stats</Trans>
                  </span>

                  <span className="mt-2 text-sm leading-none opacity-80">
                    <Trans>See spending totals and rankings</Trans>
                  </span>
                </div>
              </MenuItem>

              <MenuItem
                href={{
                  to: "/party/$partyId/share",
                  params: { partyId },
                }}
              >
                <Icon icon="lucide.share" width={20} height={20} className="mr-3" />
                <span className="h-3.5 leading-none">
                  <Trans>Share party</Trans>
                </span>
              </MenuItem>

              <MenuItem
                href={{
                  to: "/party/$partyId/settings",
                  params: { partyId },
                }}
              >
                <Icon icon="lucide.settings" width={20} height={20} className="mr-3" />
                <span className="h-3.5 leading-none">
                  <Trans>Settings</Trans>
                </span>
              </MenuItem>

              <MenuItem menuAction={onLeaveParty}>
                <Icon icon="lucide.log-out" width={20} height={20} className="mr-3" />
                <span className="h-3.5 leading-none">
                  <Trans>Leave party</Trans>
                </span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      <div className="flex-1 overflow-y-hidden">
        <AnimatedTabs
          tabListClassName="px-4 container"
          selectedTab={selectedTab}
          selectionChangeAction={selectedTabChangeAction}
          tabs={[
            {
              id: "expenses",
              label: t`Expenses`,
              node: <ExpenseLog />,
              icon: "lucide.scroll-text",
            },
            {
              id: "balances",
              label: t`Balances`,
              node: (
                <Suspense fallback={null}>
                  <Balances
                    panelRef={balancesTabPanelRef}
                    sortedBy={balancesSortedBy}
                    onRefresh={recalculateBalances}
                  />
                </Suspense>
              ),
              panelRef: balancesTabPanelRef,
              icon: "lucide.scale",
            },
          ]}
        />
      </div>
    </div>
  );
}
