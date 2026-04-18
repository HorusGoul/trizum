import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { Icon } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { BackButton } from "#src/components/BackButton.js";
import {
  getExpenseTotalAmount,
  getImpactOnBalanceForUser,
  simplifyBalanceTransactions,
  type Balance,
  type Expense,
} from "#src/models/expense.js";
import { cn } from "#src/ui/utils.js";
import { toast } from "sonner";
import { usePartyPaginatedExpenses } from "#src/hooks/usePartyPaginatedExpenses.js";
import { useCurrentParty, useParty } from "#src/hooks/useParty.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useEligibleDebtTransferParties } from "#src/hooks/useEligibleDebtTransferParties.ts";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { AnimatedTabs } from "#src/ui/AnimatedTabs.js";
import { Suspense, useEffect, useRef, type Key } from "react";
import type { BalancesSortedBy, PartyParticipant } from "#src/models/party.js";
import { Switch } from "#src/ui/Switch.tsx";
import { List, useListRef, type RowComponentProps } from "react-window";
import { usePartyBalances } from "#src/hooks/usePartyBalances.ts";
import { Skeleton } from "#src/ui/Skeleton.tsx";
import { useScrollRestorationCache } from "#src/hooks/useScrollRestorationCache.ts";
import { useScrollRestoration } from "#src/hooks/useScrollRestoration.ts";
import { Button } from "#src/ui/Button.tsx";
import {
  requestIdleCallback,
  cancelIdleCallback,
} from "#src/lib/requestIdleCallback.ts";
import { useBalancesSortedBy } from "#src/hooks/useBalancesSortBy.ts";
import { loadVisiblePartyExpenseChunks } from "#src/lib/partyPaginatedExpenses.ts";

interface PartyByIdSearchParams {
  tab: "expenses" | "balances";
}

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params: { partyId }, location }) => {
    const { party } = await guardParticipatingInParty(
      partyId,
      context,
      location,
    );

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
  const {
    party,
    partyId,
    isLoading,
    setParticipantDetails,
    recalculateBalances,
  } = useParty(params.partyId);
  const { removeParty } = usePartyList();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();
  const balancesTabPanelRef = useRef<HTMLDivElement>(null);
  const [balancesSortedBy, setBalancesSortedBy] = useBalancesSortedBy();

  function onSelectedTabChange(tab: Key) {
    void navigate({
      to: "/party/$partyId",
      params: { partyId },
      search: { tab: tab as "expenses" | "balances" },
      replace: true,
    });
  }

  const didRecalculateBalances = useRef(false);
  const { setLastOpenedPartyId } = usePartyList();
  const lastRecordedPartyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedTab !== "balances" || didRecalculateBalances.current) {
      return;
    }

    const idleCallback = requestIdleCallback(() => {
      didRecalculateBalances.current = true;
      recalculateBalances().catch(() => null);
    });

    return () => {
      cancelIdleCallback(idleCallback);
    };
  }, [selectedTab, recalculateBalances]);

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
                  <Icon
                    icon="lucide.arrow-down-a-z"
                    width={20}
                    height={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Name</Trans>
                  </span>
                  <div className="flex-1" />
                  {balancesSortedBy === "name" ? (
                    <Icon icon="lucide.check" className="ml-3" />
                  ) : null}
                </MenuItem>

                <MenuItem
                  onAction={() => setBalancesSortedBy("balance-ascending")}
                >
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

                <MenuItem
                  onAction={() => setBalancesSortedBy("balance-descending")}
                >
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
                <Icon
                  icon="lucide.users"
                  width={20}
                  height={20}
                  className="mr-3 self-start"
                />
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
                <Icon
                  icon="lucide.share"
                  width={20}
                  height={20}
                  className="mr-3"
                />
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

              <MenuItem onAction={() => void onLeaveParty()}>
                <Icon
                  icon="lucide.log-out"
                  width={20}
                  height={20}
                  className="mr-3"
                />
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
          onSelectedTabChange={onSelectedTabChange}
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

function ExpenseLog() {
  const { party, dev } = useCurrentParty();
  const { expenses, hasNext, isLoadingNext, loadNext } =
    usePartyPaginatedExpenses(party.id);
  const participant = useCurrentParticipant();
  const navigate = useNavigate();

  const filteredExpenses = expenses.filter((expense) => {
    if (participant.personalMode) {
      // If personal mode is enabled
      // Only show expenses that are paid by the participant
      if (expense.paidBy[participant.id]) {
        return true;
      }

      // Or if the participant is part of the shares of the expense
      if (expense.shares[participant.id]) {
        return true;
      }

      return false;
    }

    return true;
  });

  return (
    <>
      <div className="h-2 flex-shrink-0" />

      <div className="container relative flex min-h-0 flex-1 flex-col px-2">
        <VirtualizedExpenseList
          expenses={filteredExpenses}
          partyId={party.id}
          hasNext={hasNext}
          isLoadingNext={isLoadingNext}
          loadNext={loadNext}
        />

        <div className="pointer-events-none absolute inset-x-2 flex justify-end bottom-safe-offset-6">
          {import.meta.env.DEV ? (
            <MenuTrigger>
              <IconButton
                aria-label={t`Add or create`}
                icon="lucide.plus"
                color="accent"
                className="pointer-events-auto h-14 w-14 shadow-md"
              />

              <Popover placement="top end" offset={16}>
                <Menu className="min-w-60">
                  {import.meta.env.DEV ? (
                    <MenuItem onAction={() => void dev.createTestExpenses()}>
                      <Icon
                        icon="lucide.test-tube-diagonal"
                        width={20}
                        height={20}
                        className="mr-3"
                      />
                      <span className="h-3.5 leading-none">
                        <Trans>[DEV] Create expenses</Trans>
                      </span>
                    </MenuItem>
                  ) : null}
                  <MenuItem
                    href={{
                      to: "/party/$partyId/add",
                      params: { partyId: party.id },
                    }}
                  >
                    <Icon
                      icon="lucide.list-plus"
                      width={20}
                      height={20}
                      className="mr-3"
                    />
                    <span className="h-3.5 leading-none">
                      <Trans>Add an expense</Trans>
                    </span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          ) : (
            <IconButton
              aria-label={t`Add an expense`}
              icon="lucide.plus"
              color="accent"
              className="pointer-events-auto h-14 w-14 shadow-md"
              onPress={() => {
                void navigate({
                  to: "/party/$partyId/add",
                  params: { partyId: party.id },
                });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

const EXPENSE_ROW_GAP = 16;
const EXPENSE_LIST_BOTTOM_SPACER_HEIGHT = 120;
const EXPENSE_LIST_DEFAULT_ROW_HEIGHT = 96 + EXPENSE_ROW_GAP;

interface ExpenseListRowProps {
  expenses: Expense[];
  partyId: string;
  loaderIndex: number;
  spacerIndex: number;
}

function ExpenseListRow({
  ariaAttributes,
  expenses,
  index,
  loaderIndex,
  partyId,
  spacerIndex,
  style,
}: RowComponentProps<ExpenseListRowProps>) {
  if (index === spacerIndex) {
    return <div aria-hidden="true" style={style} />;
  }

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        boxSizing: "border-box",
        paddingBottom: EXPENSE_ROW_GAP,
      }}
    >
      {index === loaderIndex ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ExpenseItem partyId={partyId} expense={expenses[index]} />
      )}
    </div>
  );
}

function VirtualizedExpenseList({
  expenses,
  partyId,
  hasNext,
  isLoadingNext,
  loadNext,
}: {
  expenses: Expense[];
  partyId: string;
  hasNext: boolean;
  isLoadingNext: boolean;
  loadNext: () => void;
}) {
  const listRef = useListRef(null);
  const scrollRestorationCache = useScrollRestorationCache(
    `party-${partyId}-expense-list`,
  );
  const loaderIndex = hasNext ? expenses.length : -1;
  const spacerIndex = expenses.length + (hasNext ? 1 : 0);
  const rowCount = spacerIndex + 1;
  const requestedNextPageRef = useRef(false);

  useEffect(() => {
    if (!isLoadingNext) {
      requestedNextPageRef.current = false;
    }
  }, [isLoadingNext]);

  useEffect(() => {
    const listElement = listRef.current?.element;
    if (!listElement) {
      return;
    }

    const rAF = window.requestAnimationFrame(() => {
      listElement.scrollTop = scrollRestorationCache.initialScrollTop;
    });

    return () => {
      cancelAnimationFrame(rAF);
    };
  }, [listRef, scrollRestorationCache.initialScrollTop]);

  useEffect(() => {
    const listElement = listRef.current?.element;
    if (!listElement) {
      return;
    }

    return () => {
      scrollRestorationCache.setScrollTop(listElement.scrollTop);
    };
  }, [listRef, scrollRestorationCache]);

  return (
    <div className="min-h-0 flex-1">
      <List
        className="no-scrollbar h-full overflow-y-auto"
        data-testid="expense-log-list"
        listRef={listRef}
        onRowsRendered={(visibleRows) => {
          const shouldLoadNext =
            loaderIndex >= 0 &&
            visibleRows.stopIndex >= loaderIndex &&
            !isLoadingNext &&
            !requestedNextPageRef.current;

          if (shouldLoadNext) {
            requestedNextPageRef.current = true;
            loadNext();
          }
        }}
        onScroll={(event) => {
          scrollRestorationCache.setScrollTop(event.currentTarget.scrollTop);
        }}
        overscanCount={10}
        rowComponent={ExpenseListRow}
        rowCount={rowCount}
        rowHeight={(index) =>
          index === spacerIndex
            ? EXPENSE_LIST_BOTTOM_SPACER_HEIGHT
            : EXPENSE_LIST_DEFAULT_ROW_HEIGHT
        }
        rowProps={{ expenses, partyId, loaderIndex, spacerIndex }}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

function ExpenseItem({
  partyId,
  expense,
}: {
  partyId: string;
  expense: Expense;
}) {
  const { party } = useParty(partyId);

  const participant = useCurrentParticipant();

  return (
    <Link
      href={{
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId,
          expenseId: expense.id,
        },
      }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex min-h-24 w-full scale-100 rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-accent-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:bg-accent-800 dark:shadow-none",
          isPressed &&
            "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
        )
      }
    >
      <div className="flex flex-1 flex-col">
        <span className="font-medium">{expense.name}</span>
      </div>

      <div className="flex flex-shrink-0 flex-col text-end">
        <CurrencyText
          amount={getExpenseTotalAmount(expense)}
          currency={party.currency}
          className="font-medium"
        />
        <span className="text-sm">{expense.paidAt.toLocaleDateString()}</span>
        <span className="text-sm">
          <Trans>
            Impact on my balance:&nbsp;
            <CurrencyText
              amount={getImpactOnBalanceForUser(expense, participant.id)}
              currency={party.currency}
              variant="diff"
            />
          </Trans>
        </span>
      </div>
    </Link>
  );
}

function Balances({
  panelRef,
  sortedBy,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  sortedBy: BalancesSortedBy;
}) {
  const { party } = useCurrentParty();
  const participant = useCurrentParticipant();
  const balances = usePartyBalances(party.id);

  useScrollRestoration({
    cacheKey: `party-${party.id}-balances`,
    scrollElementRef: panelRef,
  });

  const sortedBalancesByParticipant = Object.values(balances)
    .map((balance) => {
      return {
        ...balance,
        participant: party.participants[balance.participantId],
      };
    })
    .filter((balance) => balance.stats.balance !== 0)
    .sort((a, b) => {
      switch (sortedBy) {
        case "name":
          return a.participant.name.localeCompare(b.participant.name);
        case "balance-ascending":
          return a.stats.balance - b.stats.balance;
        case "balance-descending":
          return b.stats.balance - a.stats.balance;
      }
    });

  const hasSortedBalances = sortedBalancesByParticipant.length > 0;

  // Use simplified transaction algorithm to get minimal set of transactions
  const simplifiedTransactions = simplifyBalanceTransactions(balances);

  // Filter transactions relevant to the current user
  const userOwesMap = simplifiedTransactions
    .filter((tx) => tx.fromId === participant.id)
    .map((tx) => ({
      participantId: tx.toId,
      amount: tx.amount,
    }));

  const owedToUserMap = simplifiedTransactions
    .filter((tx) => tx.toId === participant.id)
    .map((tx) => ({
      participantId: tx.fromId,
      amount: tx.amount,
    }));

  const isFullyBalanced =
    userOwesMap.length === 0 && owedToUserMap.length === 0;
  const eligibleTransferParties = useEligibleDebtTransferParties();
  const canTransferDebt = eligibleTransferParties.length > 0;

  // Show other transactions not involving the current user
  const allOtherDiffs = simplifiedTransactions
    .filter((tx) => tx.fromId !== participant.id && tx.toId !== participant.id)
    .map((tx) => ({
      fromId: tx.fromId,
      toId: tx.toId,
      amount: tx.amount,
    }));

  return (
    <>
      {hasSortedBalances ? (
        <>
          <div className="h-8 flex-shrink-0" />

          <div className="container flex flex-col gap-4 px-4">
            {sortedBalancesByParticipant.map(
              ({ participant, stats, visualRatio }) => (
                <BalanceItem
                  key={participant.id}
                  participant={participant}
                  stats={stats}
                  visualRatio={visualRatio}
                />
              ),
            )}
          </div>
          <div className="h-8 flex-shrink-0" />
        </>
      ) : (
        <div className="h-5 flex-shrink-0" />
      )}

      {isFullyBalanced ? null : (
        <div className="container mb-4 mt-4 flex flex-col gap-4 px-4">
          <h2 className="px-2 text-xl font-semibold">
            <Trans>How should I balance?</Trans>
          </h2>

          <p className="px-2 text-lg">
            <Trans>
              Here is a list of operations you and other party members can do to
              balance your position.
            </Trans>
          </p>
        </div>
      )}

      <div className="container flex flex-col gap-4 px-2">
        {userOwesMap.length > 0 ? (
          <>
            <h3 className="flex items-center px-4 text-warning-500">
              <Icon
                icon="lucide.circle-alert"
                width={24}
                height={24}
                className="mr-3"
              />

              <span className="text-xl font-semibold">
                <Trans>You owe money to people</Trans>
              </span>
            </h3>

            {userOwesMap.map(({ participantId, amount }) => (
              <BalanceActionItem
                key={participantId}
                fromId={participant.id}
                toId={participantId}
                amount={amount}
                canTransferDebt={canTransferDebt}
              />
            ))}
          </>
        ) : (
          <div className="flex items-center px-4 text-success-500">
            <Icon
              icon="lucide.circle-check"
              width={24}
              height={24}
              className="mr-3"
            />

            <span className="text-xl font-semibold">
              <Trans>You&apos;re debt free!</Trans>
            </span>
          </div>
        )}

        {owedToUserMap.length > 0 ? (
          <>
            <h3 className="flex items-center px-4 text-warning-500">
              <Icon
                icon="lucide.circle-alert"
                width={24}
                height={24}
                className="mr-3"
              />

              <span className="text-xl font-semibold">
                <Trans>People that owe you money</Trans>
              </span>
            </h3>

            {owedToUserMap.map(({ participantId, amount }) => (
              <BalanceActionItem
                key={participantId}
                fromId={participantId}
                toId={participant.id}
                amount={amount}
              />
            ))}
          </>
        ) : (
          <div className="flex items-center px-4 text-success-500">
            <Icon
              icon="lucide.circle-check"
              width={24}
              height={24}
              className="mr-3"
            />

            <span className="text-xl font-semibold">
              <Trans>Nobody owes you money!</Trans>
            </span>
          </div>
        )}

        {allOtherDiffs.length > 0 ? (
          <>
            <h2 className="flex items-center px-4 text-accent-400">
              <Icon
                icon="lucide.circle-help"
                width={24}
                height={24}
                className="mr-3"
              />

              <span className="text-xl font-semibold">
                <Trans>Other operations</Trans>
              </span>
            </h2>

            {allOtherDiffs.map((diff) => (
              <BalanceActionItem key={diff.fromId + diff.toId} {...diff} />
            ))}
          </>
        ) : null}
      </div>
      <div className="h-8 flex-shrink-0" />
    </>
  );
}

interface BalanceItemProps {
  participant: PartyParticipant;
  stats: Balance["stats"];
  visualRatio: number;
}

function BalanceItem({ participant, stats, visualRatio }: BalanceItemProps) {
  const { party } = useCurrentParty();

  const balance = stats.balance;
  const isNegative = balance < 0;

  const participantNode = (
    <div
      className={cn(
        "flex items-center justify-end",
        isNegative && "justify-start",
      )}
    >
      <span className="text-lg font-medium">{participant.name}</span>
    </div>
  );

  const balanceNode = (
    <div
      className={cn(
        "relative flex items-center justify-start",
        isNegative && "justify-end",
      )}
    >
      <div
        className={cn(
          "h-10 rounded-lg bg-success-300 dark:bg-success-600",
          isNegative && "bg-danger-300 dark:bg-danger-700",
        )}
        style={{
          width: `${Math.abs(visualRatio) * 100}%`,
        }}
      />

      <CurrencyText
        amount={stats.balance}
        currency={party.currency}
        variant="inherit"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-lg font-bold leading-none",
          isNegative ? "right-2" : "left-2",
        )}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {isNegative ? (
        <>
          {balanceNode}
          {participantNode}
        </>
      ) : (
        <>
          {participantNode}
          {balanceNode}
        </>
      )}
    </div>
  );
}

interface BalanceActionItemProps {
  fromId: PartyParticipant["id"];
  toId: PartyParticipant["id"];
  amount: number;
  canTransferDebt?: boolean;
}

function BalanceActionItem({
  fromId,
  toId,
  amount,
  canTransferDebt = false,
}: BalanceActionItemProps) {
  const { party } = useCurrentParty();
  const me = useCurrentParticipant();
  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isFromMe = fromId === me.id;
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-accent-900">
      <div className="flex">
        <div className="flex flex-1 flex-col">
          <span className="text-lg text-accent-400">
            {from.name} {fromId === me.id ? t`(me)` : ""}
          </span>
          <span className="text-sm text-accent-700 dark:text-accent-300">
            <Trans>owes</Trans>
          </span>
          <span className="text-lg text-accent-400">
            {to.name} {toId === me.id ? t`(me)` : ""}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center">
          <CurrencyText
            currency={party.currency}
            amount={Math.abs(amount)}
            className="text-xl"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          color="input-like"
          className="h-8 rounded-lg px-4"
          onPress={() =>
            void navigate({
              to: "/party/$partyId/pay",
              params: {
                partyId: party.id,
              },
              search: {
                fromId,
                toId,
                amount: Math.abs(amount),
              },
            })
          }
        >
          {isFromMe ? <Trans>Pay</Trans> : <Trans>Mark as paid</Trans>}
        </Button>

        {isFromMe && canTransferDebt ? (
          <Button
            color="input-like"
            className="h-8 rounded-lg px-4"
            onPress={() =>
              void navigate({
                to: "/party/$partyId/transfer-debt",
                params: {
                  partyId: party.id,
                },
                search: {
                  fromId,
                  toId,
                  amount: Math.abs(amount),
                },
              })
            }
          >
            <Trans>Transfer debt</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
