import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { Icon, IconWithFallback } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { BackButton } from "#src/components/BackButton.js";
import { t, Trans } from "@lingui/macro";
import {
  exportIntoInput,
  getExpenseTotalAmount,
  getImpactOnBalanceForUser,
  type Expense,
} from "#src/models/expense.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { cn } from "#src/ui/utils.js";
import { toast } from "sonner";
import { usePartyExpenses } from "#src/hooks/usePartyExpenses.js";
import { useCurrentParty, useParty } from "#src/hooks/useParty.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { AnimatedTabs } from "#src/ui/AnimatedTabs.js";
import { useMemo, useRef } from "react";
import { calculateLogStatsOfUser } from "#src/lib/expenses.js";
import type { PartyParticipant } from "#src/models/party.js";
import { Switch } from "#src/ui/Switch.tsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNoMemo } from "#src/hooks/useNoMemo.ts";

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
  loader: async ({ context, params: { partyId } }) => {
    const { party } = await guardParticipatingInParty(partyId, context);

    await Promise.all(
      party.chunkIds.map((chunkId) => {
        return documentCache.readAsync(context.repo, chunkId);
      }),
    );

    return;
  },
});

function PartyById() {
  const params = Route.useParams();
  const { party, partyId, isLoading, setParticipantDetails } = useParty(
    params.partyId,
  );
  const { removeParty } = usePartyList();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();
  const expenseLogTabPanelRef = useRef<HTMLDivElement>(null);

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

  function onTogglePersonalMode() {
    setParticipantDetails(participant.id, {
      personalMode: !participant.personalMode,
    });
  }

  return (
    <div className="flex h-full max-h-full flex-col">
      <div className="container flex h-16 flex-shrink-0 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{party.name}</h1>
        <div className="flex-1" />
        <MenuTrigger>
          <IconButton icon="#lucide/ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu className="min-w-60">
              <MenuItem
                href={{
                  to: "/party/$partyId/who",
                  params: { partyId },
                }}
              >
                <IconWithFallback
                  name="#lucide/user-round-pen"
                  size={20}
                  className="mr-3 self-start"
                />
                <div className="flex flex-col">
                  <span className="leading-none">
                    <Trans>Viewing as {participant.name}</Trans>
                  </span>

                  <span className="mt-2 text-sm leading-none opacity-80">
                    <Trans>Tap to change</Trans>
                  </span>
                </div>
              </MenuItem>

              <MenuItem onAction={onTogglePersonalMode}>
                <IconWithFallback
                  name="#lucide/user-round-check"
                  size={20}
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
                  to: "/party/$partyId/settings",
                  params: { partyId },
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

              <MenuItem onAction={onLeaveParty}>
                <IconWithFallback
                  name="#lucide/log-out"
                  size={20}
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
          tabs={[
            {
              id: "expenses",
              label: t`Expenses`,
              node: <ExpenseLog panelRef={expenseLogTabPanelRef} />,
              panelRef: expenseLogTabPanelRef,
              icon: "#lucide/scroll-text",
            },
            {
              id: "balances",
              label: t`Balances`,
              node: <Balances />,
              icon: "#lucide/scale",
            },
          ]}
        />
      </div>
    </div>
  );
}

function ExpenseLog({
  panelRef,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { party, dev } = useCurrentParty();
  const expenses = usePartyExpenses(party.id);
  const participant = useCurrentParticipant();

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

  const rowVirtualizer = useVirtualizer({
    count: filteredExpenses.length,
    getScrollElement: () => panelRef.current,
    estimateSize: () => 96,
    getItemKey: (index) => filteredExpenses[index].id,
    gap: 16,
    overscan: 10,
  });

  // https://github.com/TanStack/virtual/issues/743#issuecomment-2894893548
  const virtualItems = useNoMemo(() => rowVirtualizer.getVirtualItems());

  return (
    <>
      <div className="h-2 flex-shrink-0" />

      <div className="container flex flex-1 flex-col px-2">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ExpenseItem
                partyId={party.id}
                expense={filteredExpenses[virtualItem.index]}
              />
            </div>
          ))}
        </div>

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
                {import.meta.env.DEV ? (
                  <MenuItem onAction={() => dev.createTestExpenses()}>
                    <IconWithFallback
                      name="#lucide/test-tube-diagonal"
                      size={20}
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
                  <IconWithFallback
                    name="#lucide/list-plus"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Add an expense</Trans>
                  </span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </>
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
          "flex w-full scale-100 rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-slate-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:bg-slate-800 dark:shadow-none",
          isPressed &&
            "scale-95 bg-opacity-90 shadow-lg dark:bg-slate-700 dark:shadow-none",
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

function Balances() {
  const { party } = useCurrentParty();
  const expenses = usePartyExpenses(party.id);
  const participant = useCurrentParticipant();

  const balancesByParticipant = useMemo(() => {
    const inputs = expenses.flatMap(exportIntoInput);
    const participants = Object.values(party.participants);
    const participantIds = Object.keys(party.participants);

    const balances = participants
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((participant) => {
        return {
          participant,
          stats: calculateLogStatsOfUser(
            participant.id,
            participantIds,
            inputs,
          ),
          visualRatio: 0,
        };
      });

    const biggestAbsoluteBalance = balances.reduce((prev, next) => {
      const prevAbs = Math.abs(prev.stats.balance.getAmount());
      const nextAbs = Math.abs(next.stats.balance.getAmount());

      return prevAbs > nextAbs ? prev : next;
    });

    // Biggest absolute balance should be considered as the reference point (1)
    const referenceBalance = biggestAbsoluteBalance.stats.balance.getAmount();

    // Use the reference balance to calculate the visual ratio of each balance
    for (const balance of balances) {
      balance.visualRatio =
        balance.stats.balance.getAmount() / referenceBalance;
    }

    return balances;
  }, [party.participants, expenses]);

  const myBalance = balancesByParticipant.find(
    (balance) => balance.participant.id === participant.id,
  );

  if (!myBalance) {
    throw new Error("Balance not found");
  }

  const userOwesMap = Object.entries(myBalance.stats.diffs)
    .filter(([_, diff]) => {
      return diff.diffUnsplitted.getAmount() < 0;
    })
    .map(([participantId, diff]) => {
      return {
        participantId,
        amount: diff.diffUnsplitted.getAmount(),
      };
    });

  const owedToUserMap = Object.entries(myBalance.stats.diffs)
    .filter(([_, diff]) => {
      return diff.diffUnsplitted.getAmount() > 0;
    })
    .map(([participantId, diff]) => {
      return {
        participantId,
        amount: diff.diffUnsplitted.getAmount(),
      };
    });

  const isFullyBalanced =
    userOwesMap.length === 0 && owedToUserMap.length === 0;

  const allOtherDiffs = balancesByParticipant
    .filter((balance) => {
      if (balance.participant.id === participant.id) {
        return false;
      }

      if (balance.stats.balance.getAmount() >= 0) {
        return false;
      }

      return true;
    })
    .flatMap((balance) => {
      return Object.entries(balance.stats.diffs)
        .filter(([participantId]) => {
          if (participantId === participant.id) {
            return false;
          }

          const diff = balance.stats.diffs[participantId];

          if (diff.diffUnsplitted.getAmount() >= 0) {
            return false;
          }

          return true;
        })
        .map(([participantId, diff]) => {
          return {
            fromId: balance.participant.id,
            toId: participantId,
            amount: diff.diffUnsplitted.getAmount(),
          };
        });
    });

  return (
    <>
      <div className="h-8 flex-shrink-0" />

      <div className="container flex flex-col gap-4 px-4">
        {balancesByParticipant.map(({ participant, stats, visualRatio }) => (
          <BalanceItem
            key={participant.id}
            participant={participant}
            stats={stats}
            visualRatio={visualRatio}
          />
        ))}
      </div>

      <div className="h-8 flex-shrink-0" />

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
              <Icon name="#lucide/circle-alert" size={24} className="mr-3" />

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
              />
            ))}
          </>
        ) : (
          <div className="flex items-center px-4 text-success-500">
            <Icon name="#lucide/circle-check" size={24} className="mr-3" />

            <span className="text-xl font-semibold">
              <Trans>You&apos;re debt free!</Trans>
            </span>
          </div>
        )}

        {owedToUserMap.length > 0 ? (
          <>
            <h3 className="flex items-center px-4 text-warning-500">
              <Icon name="#lucide/circle-alert" size={24} className="mr-3" />

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
            <Icon name="#lucide/circle-check" size={24} className="mr-3" />

            <span className="text-xl font-semibold">
              <Trans>Nobody owes you money!</Trans>
            </span>
          </div>
        )}

        {allOtherDiffs.length > 0 ? (
          <>
            <h2 className="flex items-center px-4 text-accent-400">
              <Icon name="#lucide/circle-help" size={24} className="mr-3" />

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
  stats: ReturnType<typeof calculateLogStatsOfUser>;
  visualRatio: number;
}

function BalanceItem({ participant, stats, visualRatio }: BalanceItemProps) {
  const { party } = useCurrentParty();

  const balance = stats.balance.getAmount();
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
        amount={stats.balance.getAmount()}
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
}

function BalanceActionItem({ fromId, toId, amount }: BalanceActionItemProps) {
  const { party } = useCurrentParty();
  const from = party.participants[fromId];
  const to = party.participants[toId];

  return (
    <div className="flex rounded-xl bg-white p-4 dark:bg-slate-900">
      <div className="flex flex-1 flex-col">
        <span className="text-lg text-accent-400">{from.name}</span>
        <span className="text-sm text-slate-700 dark:text-slate-300">owes</span>
        <span className="text-lg text-accent-400">{to.name}</span>
      </div>

      <div className="flex flex-shrink-0 items-center">
        <CurrencyText
          currency={party.currency}
          amount={Math.abs(amount)}
          className="text-xl"
        />
      </div>
    </div>
  );
}
