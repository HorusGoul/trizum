import { Trans } from "@lingui/react/macro";
import { useEligibleDebtTransferParties } from "#src/hooks/useEligibleDebtTransferParties.ts";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { usePartyBalances } from "#src/hooks/usePartyBalances.ts";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { useScrollRestoration } from "#src/hooks/useScrollRestoration.ts";
import { simplifyBalanceTransactions } from "#src/models/expense.js";
import type { BalancesSortedBy } from "#src/models/party.js";
import { Icon } from "#src/ui/Icon.js";
import { BalanceActionItem } from "./BalanceActionItem.js";
import { BalanceItem } from "./BalanceItem.js";
import { PullToRefresh } from "./PullToRefresh.js";

export function Balances({
  panelRef,
  sortedBy,
  onRefresh,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  sortedBy: BalancesSortedBy;
  onRefresh: () => Promise<unknown>;
}) {
  const { party } = useCurrentParty();
  const participant = useCurrentParticipant();
  const balances = usePartyBalances(party.id);

  useScrollRestoration({
    cacheKey: `party-${party.id}-balances`,
    scrollElementRef: panelRef,
  });

  const sortedBalancesByParticipant = [];
  for (const balance of Object.values(balances)) {
    if (balance.stats.balance !== 0) {
      sortedBalancesByParticipant.push({
        ...balance,
        participant: party.participants[balance.participantId],
      });
    }
  }
  sortedBalancesByParticipant.sort((a, b) => {
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
  const simplifiedTransactions = simplifyBalanceTransactions(balances);
  const userOwesMap = [];
  const owedToUserMap = [];
  const allOtherDiffs = [];

  for (const tx of simplifiedTransactions) {
    if (tx.fromId === participant.id) {
      userOwesMap.push({
        participantId: tx.toId,
        amount: tx.amount,
      });
      continue;
    }

    if (tx.toId === participant.id) {
      owedToUserMap.push({
        participantId: tx.fromId,
        amount: tx.amount,
      });
      continue;
    }

    allOtherDiffs.push({
      fromId: tx.fromId,
      toId: tx.toId,
      amount: tx.amount,
    });
  }

  const isFullyBalanced = userOwesMap.length === 0 && owedToUserMap.length === 0;
  const eligibleTransferParties = useEligibleDebtTransferParties();
  const canTransferDebt = eligibleTransferParties.length > 0;

  return (
    <PullToRefresh scrollElementRef={panelRef} refreshAction={onRefresh}>
      {hasSortedBalances ? (
        <>
          <div className="h-8 flex-shrink-0" />

          <div className="container flex flex-col gap-4 px-4">
            {sortedBalancesByParticipant.map(({ participant, stats, visualRatio }) => (
              <BalanceItem
                key={participant.id}
                participant={participant}
                stats={stats}
                visualRatio={visualRatio}
              />
            ))}
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
              Here is a list of operations you and other party members can do to balance your
              position.
            </Trans>
          </p>
        </div>
      )}

      <div className="container flex flex-col gap-4 px-2">
        {userOwesMap.length > 0 ? (
          <>
            <h3 className="flex items-center px-4 text-warning-500">
              <Icon icon="lucide.circle-alert" width={24} height={24} className="mr-3" />

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
            <Icon icon="lucide.circle-check" width={24} height={24} className="mr-3" />

            <span className="text-xl font-semibold">
              <Trans>You&apos;re debt free!</Trans>
            </span>
          </div>
        )}

        {owedToUserMap.length > 0 ? (
          <>
            <h3 className="flex items-center px-4 text-warning-500">
              <Icon icon="lucide.circle-alert" width={24} height={24} className="mr-3" />

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
            <Icon icon="lucide.circle-check" width={24} height={24} className="mr-3" />

            <span className="text-xl font-semibold">
              <Trans>Nobody owes you money!</Trans>
            </span>
          </div>
        )}

        {allOtherDiffs.length > 0 ? (
          <>
            <h2 className="flex items-center px-4 text-accent-400">
              <Icon icon="lucide.circle-help" width={24} height={24} className="mr-3" />

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
    </PullToRefresh>
  );
}
