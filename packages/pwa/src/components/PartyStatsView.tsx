import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { useScrollRestoration } from "#src/hooks/useScrollRestoration.ts";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import {
  calculatePartyStats,
  type PartyStatsParticipantStat,
  type PartyStatsTimeframe,
} from "#src/lib/partyStats.ts";
import type { PartyExpenseChunk, PartyParticipant } from "#src/models/party.js";
import { Icon } from "#src/ui/Icon.js";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { cn } from "#src/ui/utils.js";
import {
  Suspense,
  startTransition,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";

interface PartyStatsViewProps {
  scrollElementRef: RefObject<HTMLDivElement | null>;
}

interface PartyStatsContentProps {
  scrollElementRef: RefObject<HTMLDivElement | null>;
  timeframe: PartyStatsTimeframe;
  onTimeframeChange: (timeframe: PartyStatsTimeframe) => void;
}

interface StatsTimeframeOption {
  id: PartyStatsTimeframe;
  label: string;
}

interface StatsSummaryCardProps {
  icon: "#lucide/calendar" | "#lucide/scale" | "#lucide/user" | "#lucide/users";
  label: string;
  value: ReactNode;
  description: ReactNode;
}

interface StatsSectionProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
}

interface StatsParticipantRowProps {
  currency: ComponentProps<typeof CurrencyText>["currency"];
  participant: PartyStatsParticipantStat;
  currentParticipantId: PartyParticipant["id"];
  rank?: number;
}

interface StatsEmptyStateProps {
  hasAnyTrackedExpense: boolean;
}

export function PartyStatsView({ scrollElementRef }: PartyStatsViewProps) {
  const [timeframe, setTimeframe] = useState<PartyStatsTimeframe>("all-time");

  return (
    <Suspense fallback={null}>
      <PartyStatsContent
        scrollElementRef={scrollElementRef}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />
    </Suspense>
  );
}

function PartyStatsContent({
  scrollElementRef,
  timeframe,
  onTimeframeChange,
}: PartyStatsContentProps) {
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const chunkDocuments = useMultipleSuspenseDocument<PartyExpenseChunk>(
    party.chunkRefs.map((chunkRef) => chunkRef.chunkId),
    { required: true },
  );
  const expenses = chunkDocuments.flatMap(({ doc }) => doc.expenses);
  const allTimeStats = calculatePartyStats({
    expenses,
    participants: party.participants,
    timeframe: "all-time",
  });
  const stats =
    timeframe === "all-time"
      ? allTimeStats
      : calculatePartyStats({
          expenses,
          participants: party.participants,
          timeframe,
        });
  const currentParticipantStats = stats.participantStats.find(
    (participant) => participant.participantId === currentParticipant.id,
  );
  const currentParticipantName = currentParticipant.name;
  const timeframeOptions: StatsTimeframeOption[] = [
    { id: "all-time", label: t`All time` },
    { id: "last-year", label: t`Last year` },
    { id: "current-year", label: t`Current year` },
    { id: "current-month", label: t`Current month` },
  ];
  const hasAnyTrackedExpense = allTimeStats.totalExpenseCount > 0;

  useScrollRestoration({
    cacheKey: `party-${party.id}-stats`,
    scrollElementRef,
  });

  return (
    <div className="container flex flex-col gap-4 px-4 pb-8 pt-4">
      <div className="rounded-2xl bg-accent-50 p-4 shadow-sm dark:bg-accent-900 dark:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold">
              <Trans>Party stats</Trans>
            </h2>

            <p className="mt-2 text-sm text-accent-700 dark:text-accent-200">
              <Trans>
                Compare how much everyone has paid across different timeframes.
                Settlement transfers are excluded from these totals.
              </Trans>
            </p>
          </div>

          <div className="w-full md:max-w-56">
            <AppSelect<StatsTimeframeOption>
              label={t`Timeframe`}
              description={t`Filter totals and rankings`}
              items={timeframeOptions}
              selectedKey={timeframe}
              onSelectionChange={(nextTimeframe) => {
                if (!nextTimeframe) {
                  return;
                }

                startTransition(() => {
                  onTimeframeChange(nextTimeframe as PartyStatsTimeframe);
                });
              }}
            >
              {(option) => (
                <SelectItem key={option.id} value={option}>
                  {option.label}
                </SelectItem>
              )}
            </AppSelect>
          </div>
        </div>
      </div>

      {hasAnyTrackedExpense ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatsSummaryCard
            icon="#lucide/scale"
            label={t`Total spent`}
            value={
              <CurrencyText
                amount={stats.totalSpent}
                currency={party.currency}
                className="text-2xl font-semibold"
                variant="inherit"
              />
            }
            description={<Trans>Across the selected timeframe</Trans>}
          />

          <StatsSummaryCard
            icon="#lucide/user"
            label={t`Your total`}
            value={
              <CurrencyText
                amount={currentParticipantStats?.totalSpent ?? 0}
                currency={party.currency}
                className="text-2xl font-semibold"
                variant="inherit"
              />
            }
            description={<Trans>Paid as {currentParticipantName}</Trans>}
          />

          <StatsSummaryCard
            icon="#lucide/calendar"
            label={t`Expenses counted`}
            value={
              <span className="text-2xl font-semibold">
                {stats.totalExpenseCount}
              </span>
            }
            description={<Trans>Non-transfer expenses in this timeframe</Trans>}
          />

          <StatsSummaryCard
            icon="#lucide/users"
            label={t`Top spender`}
            value={
              stats.topSpender ? (
                <span className="text-2xl font-semibold">
                  {stats.topSpender.name}
                </span>
              ) : (
                <span className="text-2xl font-semibold">
                  <Trans>Nobody yet</Trans>
                </span>
              )
            }
            description={
              stats.topSpender ? (
                <CurrencyText
                  amount={stats.topSpender.totalSpent}
                  currency={party.currency}
                  variant="inherit"
                />
              ) : (
                <Trans>No spending in this timeframe</Trans>
              )
            }
          />
        </div>
      ) : null}

      {hasAnyTrackedExpense ? (
        stats.totalExpenseCount > 0 ? (
          <>
            <StatsSection
              title={t`Biggest spenders`}
              description={
                <Trans>
                  Ranking based on how much each participant paid in the
                  selected timeframe.
                </Trans>
              }
            >
              <div className="flex flex-col gap-3">
                {stats.ranking.map((participant, index) => (
                  <StatsParticipantRow
                    key={participant.participantId}
                    currency={party.currency}
                    participant={participant}
                    currentParticipantId={currentParticipant.id}
                    rank={index + 1}
                  />
                ))}
              </div>
            </StatsSection>

            <StatsSection
              title={t`Individual totals`}
              description={
                <Trans>
                  Total paid by each participant in the selected timeframe.
                </Trans>
              }
            >
              <div className="flex flex-col gap-3">
                {stats.participantStats.map((participant) => (
                  <StatsParticipantRow
                    key={participant.participantId}
                    currency={party.currency}
                    participant={participant}
                    currentParticipantId={currentParticipant.id}
                  />
                ))}
              </div>
            </StatsSection>
          </>
        ) : (
          <StatsEmptyState hasAnyTrackedExpense={true} />
        )
      ) : (
        <StatsEmptyState hasAnyTrackedExpense={false} />
      )}
    </div>
  );
}

function StatsSummaryCard({
  icon,
  label,
  value,
  description,
}: StatsSummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-accent-900 dark:shadow-none">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-accent-100 p-3 text-accent-500 dark:bg-accent-800 dark:text-accent-200">
          <Icon name={icon} size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-accent-700 dark:text-accent-200">
            {label}
          </div>

          <div className="mt-2 text-accent-950 dark:text-accent-50">
            {value}
          </div>

          <div className="mt-1 text-sm text-accent-700 dark:text-accent-300">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsSection({ title, description, children }: StatsSectionProps) {
  return (
    <section className="rounded-2xl bg-accent-50 p-4 dark:bg-accent-900">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>

        <p className="mt-2 text-sm text-accent-700 dark:text-accent-200">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function StatsParticipantRow({
  currency,
  participant,
  currentParticipantId,
  rank,
}: StatsParticipantRowProps) {
  const isCurrentParticipant =
    participant.participantId === currentParticipantId;
  const hasSpent = participant.totalSpent > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-accent-950 dark:shadow-none",
        !hasSpent && "opacity-70",
      )}
    >
      {rank ? (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-600 dark:bg-accent-800 dark:text-accent-100">
          #{rank}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-medium">{participant.name}</span>

          {isCurrentParticipant ? (
            <span className="rounded-sm bg-accent-500 px-1 text-xs font-semibold uppercase text-accent-50">
              {t`Me`}
            </span>
          ) : null}

          {participant.isArchived ? (
            <span className="rounded-sm bg-accent-200 px-1 text-xs font-semibold uppercase text-accent-700 dark:bg-accent-800 dark:text-accent-100">
              {t`Archived`}
            </span>
          ) : null}
        </div>

        {!hasSpent ? (
          <div className="mt-1 text-sm text-accent-700 dark:text-accent-300">
            <Trans>No spending in this timeframe</Trans>
          </div>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 items-center">
        <CurrencyText
          amount={participant.totalSpent}
          currency={currency}
          className="text-lg font-semibold"
          variant="inherit"
        />
      </div>
    </div>
  );
}

function StatsEmptyState({ hasAnyTrackedExpense }: StatsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-accent-300 bg-white p-6 text-center shadow-sm dark:border-accent-700 dark:bg-accent-900 dark:shadow-none">
      <h2 className="text-xl font-semibold">
        {hasAnyTrackedExpense ? (
          <Trans>No spending stats for this timeframe</Trans>
        ) : (
          <Trans>No spending stats yet</Trans>
        )}
      </h2>

      <p className="mt-2 text-sm text-accent-700 dark:text-accent-200">
        {hasAnyTrackedExpense ? (
          <Trans>
            Try another timeframe to compare a different period of your party.
          </Trans>
        ) : (
          <Trans>
            Add expenses to this party to unlock totals, rankings, and
            individual spend.
          </Trans>
        )}
      </p>
    </div>
  );
}
