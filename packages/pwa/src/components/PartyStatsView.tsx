import {
  endOfWeek,
  getLocalTimeZone,
  startOfWeek,
  today,
} from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { useScrollRestoration } from "#src/hooks/useScrollRestoration.ts";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import {
  calculatePartyStats,
  getPartyStatsAvailablePastYears,
  type PartyStatsParticipantStat,
  type PartyStatsTimeframe,
} from "#src/lib/partyStats.ts";
import type { PartyExpenseChunk, PartyParticipant } from "#src/models/party.js";
import { Avatar } from "#src/ui/Avatar.tsx";
import { Button } from "#src/ui/Button.tsx";
import {
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  RangeCalendar,
} from "#src/ui/Calendar.tsx";
import { Icon } from "#src/ui/Icon.js";
import { Popover, PopoverDialog, PopoverTrigger } from "#src/ui/Popover.tsx";
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

interface StatsTimeframeOption {
  id: PartyStatsTimeframeKey;
  label: string;
}

interface StatsSummaryCardProps {
  icon: "#lucide/calendar" | "#lucide/scale";
  label: string;
  value: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
}

interface StatsPodiumEntry {
  avatarId?: PartyParticipant["avatarId"] | null;
  participant: PartyStatsParticipantStat;
  rank: number;
  shareOfTotal: number;
  tier: "first" | "second" | "third";
}

interface StatsPodiumProps {
  currency: ComponentProps<typeof CurrencyText>["currency"];
  currentParticipantId: PartyParticipant["id"];
  first?: StatsPodiumEntry;
  second?: StatsPodiumEntry;
  third?: StatsPodiumEntry;
}

interface StatsParticipantRowProps {
  avatarId?: PartyParticipant["avatarId"] | null;
  currency: ComponentProps<typeof CurrencyText>["currency"];
  participant: PartyStatsParticipantStat;
  currentParticipantId: PartyParticipant["id"];
  totalSpent: number;
  rank: number;
}

interface StatsEmptyStateProps {
  hasAnyTrackedExpense: boolean;
}

interface StatsCustomRange {
  start: CalendarDate;
  end: CalendarDate;
}

interface CompactRangePickerProps {
  value: StatsCustomRange;
  onChange: (value: StatsCustomRange) => void;
}

type PartyStatsTimeframeKey =
  | "all-time"
  | "current-year"
  | "current-month"
  | "custom-range"
  | `year:${number}`;

const getRankingNameClassName = (name: string, variant: "list" | "podium") => {
  const normalizedLength = name.trim().length;

  if (variant === "podium") {
    if (normalizedLength >= 14) {
      return "text-sm sm:text-base";
    }

    if (normalizedLength >= 10) {
      return "text-base sm:text-lg";
    }

    return "text-lg sm:text-xl";
  }

  if (normalizedLength >= 18) {
    return "text-sm sm:text-base";
  }

  if (normalizedLength >= 12) {
    return "text-base sm:text-lg";
  }

  return "text-lg";
};

const getRankingAmountClassName = (
  amount: number,
  variant: "list" | "podium" | "winner",
) => {
  const digits = Math.abs(Math.trunc(amount)).toString().length;

  if (variant === "winner") {
    return digits >= 5 ? "text-xl sm:text-2xl" : "text-2xl";
  }

  if (variant === "podium") {
    return digits >= 5 ? "text-base sm:text-lg" : "text-lg";
  }

  if (digits >= 5) {
    return "text-base sm:text-lg";
  }

  return "text-lg";
};

export function PartyStatsView({ scrollElementRef }: PartyStatsViewProps) {
  return (
    <Suspense fallback={null}>
      <PartyStatsContent scrollElementRef={scrollElementRef} />
    </Suspense>
  );
}

function PartyStatsContent({ scrollElementRef }: PartyStatsViewProps) {
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const { i18n } = useLingui();
  const chunkDocuments = useMultipleSuspenseDocument<PartyExpenseChunk>(
    party.chunkRefs.map((chunkRef) => chunkRef.chunkId),
    { required: true },
  );
  const expenses = chunkDocuments.flatMap(({ doc }) => doc.expenses);
  const timezone = getLocalTimeZone();
  const pastYears = getPartyStatsAvailablePastYears({ expenses });
  const [timeframeKey, setTimeframeKey] =
    useState<PartyStatsTimeframeKey>("all-time");
  const [customRange, setCustomRange] = useState<StatsCustomRange>(() =>
    getDefaultCustomRange({
      locale: i18n.locale,
      timezone,
    }),
  );
  const allTimeStats = calculatePartyStats({
    expenses,
    participants: party.participants,
    timeframe: "all-time",
  });
  const timeframeOptions: StatsTimeframeOption[] = [
    { id: "all-time", label: t`All time` },
    { id: "current-month", label: t`Current month` },
    { id: "current-year", label: t`Current year` },
    ...pastYears.map((year) => ({
      id: `year:${year}` as const,
      label: String(year),
    })),
    {
      id: "custom-range",
      label: t({
        comment:
          "Timeframe option on the party stats screen for choosing any start and end dates",
        message: "Custom range",
      }),
    },
  ];
  const selectedTimeframeKey = timeframeOptions.some(
    (option) => option.id === timeframeKey,
  )
    ? timeframeKey
    : "all-time";
  const timeframe = getStatsTimeframe(
    selectedTimeframeKey,
    customRange,
    timezone,
  );
  const stats =
    selectedTimeframeKey === "all-time"
      ? allTimeStats
      : calculatePartyStats({
          expenses,
          participants: party.participants,
          timeframe,
        });
  const hasAnyTrackedExpense = allTimeStats.totalExpenseCount > 0;
  const leaderboard = stats.ranking;
  const winner = leaderboard[0] ?? null;
  const podium = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);
  const firstPlace = winner
    ? {
        avatarId: party.participants[winner.participantId]?.avatarId,
        participant: winner,
        rank: 1,
        shareOfTotal:
          stats.totalSpent > 0 ? winner.totalSpent / stats.totalSpent : 0,
        tier: "first" as const,
      }
    : undefined;
  const secondPlace = podium[1]
    ? {
        avatarId: party.participants[podium[1].participantId]?.avatarId,
        participant: podium[1],
        rank: 2,
        shareOfTotal:
          stats.totalSpent > 0 ? podium[1].totalSpent / stats.totalSpent : 0,
        tier: "second" as const,
      }
    : undefined;
  const thirdPlace = podium[2]
    ? {
        avatarId: party.participants[podium[2].participantId]?.avatarId,
        participant: podium[2],
        rank: 3,
        shareOfTotal:
          stats.totalSpent > 0 ? podium[2].totalSpent / stats.totalSpent : 0,
        tier: "third" as const,
      }
    : undefined;
  useScrollRestoration({
    cacheKey: `party-${party.id}-stats`,
    scrollElementRef,
  });

  return (
    <div className="container flex min-h-full flex-col gap-5 px-4 pb-24 pt-3">
      <section className="flex flex-wrap items-center justify-end gap-2">
        <AppSelect<StatsTimeframeOption>
          aria-label={t({
            comment: "Label for the timeframe filter on the party stats screen",
            message: "Timeframe",
          })}
          className="w-full gap-0 sm:w-auto [&>button]:h-9 [&>button]:w-full [&>button]:rounded-full [&>button]:border-accent-300 [&>button]:bg-accent-50 [&>button]:px-3 sm:[&>button]:w-auto sm:[&>button]:min-w-44 dark:[&>button]:border-accent-700 dark:[&>button]:bg-accent-900"
          items={timeframeOptions}
          selectedKey={selectedTimeframeKey}
          onSelectionChange={(nextTimeframe) => {
            if (!nextTimeframe) {
              return;
            }

            startTransition(() => {
              setTimeframeKey(nextTimeframe as PartyStatsTimeframeKey);
            });
          }}
        >
          {(option) => (
            <SelectItem key={option.id} value={option}>
              {option.label}
            </SelectItem>
          )}
        </AppSelect>

        {selectedTimeframeKey === "custom-range" ? (
          <CompactRangePicker
            value={customRange}
            onChange={(nextRange) => {
              startTransition(() => {
                setCustomRange(nextRange);
              });
            }}
          />
        ) : null}
      </section>

      <section className="rounded-[1.9rem] border border-accent-300/80 bg-gradient-to-br from-accent-500 via-accent-600 to-accent-700 p-5 text-accent-50 shadow-sm lg:p-6 dark:border-accent-500/60 dark:from-accent-700 dark:via-accent-800 dark:to-accent-950 dark:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-50/75">
              <Trans>Total spent</Trans>
            </div>

            <div className="mt-3">
              <CurrencyText
                amount={stats.totalSpent}
                currency={party.currency}
                className="text-[2.7rem] font-semibold tracking-tight sm:text-5xl lg:text-[4rem]"
                variant="inherit"
              />
            </div>

            <p className="mt-2 text-sm text-accent-50/80">
              <Trans>Across the selected timeframe</Trans>
            </p>
          </div>

          <StatsSummaryCard
            compact
            icon="#lucide/calendar"
            label={t`Expenses counted`}
            value={
              <span className="text-lg font-semibold tracking-tight">
                {stats.totalExpenseCount}
              </span>
            }
            description={<Trans>Non-transfer expenses in this timeframe</Trans>}
          />
        </div>
      </section>

      {hasAnyTrackedExpense ? (
        stats.totalExpenseCount > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-accent-950 dark:text-accent-50">
                <Trans>Participants</Trans>
              </h2>

              <div className="text-sm text-accent-700 dark:text-accent-300">
                {leaderboard.length} <Trans>participants</Trans>
              </div>
            </div>

            {firstPlace || secondPlace || thirdPlace ? (
              <StatsPodium
                currency={party.currency}
                currentParticipantId={currentParticipant.id}
                first={firstPlace}
                second={secondPlace}
                third={thirdPlace}
              />
            ) : null}

            {restOfLeaderboard.length > 0 ? (
              <div className="flex flex-col gap-3">
                {restOfLeaderboard.map((participant, index) => (
                  <StatsParticipantRow
                    avatarId={
                      party.participants[participant.participantId]?.avatarId
                    }
                    key={participant.participantId}
                    currency={party.currency}
                    currentParticipantId={currentParticipant.id}
                    participant={participant}
                    rank={index + 4}
                    totalSpent={stats.totalSpent}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <StatsEmptyState hasAnyTrackedExpense={true} />
        )
      ) : (
        <StatsEmptyState hasAnyTrackedExpense={false} />
      )}

      <div aria-hidden="true" className="h-16 flex-shrink-0" />
    </div>
  );
}

function StatsSummaryCard({
  icon,
  label,
  value,
  description,
  badge,
  compact = false,
}: StatsSummaryCardProps) {
  if (compact) {
    return (
      <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-2 text-accent-50 shadow-sm backdrop-blur-sm sm:self-start dark:bg-accent-950/30 dark:shadow-none">
        <span className="bg-white/12 rounded-full p-1.5 text-accent-50">
          <Icon name={icon} size={14} />
        </span>

        <span className="text-base font-semibold tracking-tight">{value}</span>
        <span className="text-accent-50/72 text-[11px] font-semibold uppercase tracking-[0.18em]">
          {label}
        </span>

        {badge !== undefined && badge !== null ? (
          <span className="bg-white/12 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold text-accent-50">
            {badge}
          </span>
        ) : null}

        <span className="sr-only">{description}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-[1.35rem] border border-white/15 bg-white/10 shadow-sm backdrop-blur-sm sm:w-52 dark:bg-accent-950/30 dark:shadow-none",
        "p-4",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("bg-white/12 rounded-full p-3 text-accent-50")}>
          <Icon name={icon} size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-50/70">
              {label}
            </div>

            {badge !== undefined && badge !== null ? (
              <div className="bg-white/12 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-accent-50">
                {badge}
              </div>
            ) : null}
          </div>

          <div className="mt-3 text-accent-50">{value}</div>
          <div className={cn("text-accent-50/70", "mt-2 text-sm")}>
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsPodium({
  currency,
  currentParticipantId,
  first,
  second,
  third,
}: StatsPodiumProps) {
  return (
    <div className="rounded-[1.75rem] border border-accent-200/80 bg-accent-50/80 p-4 shadow-sm dark:border-accent-800 dark:bg-accent-950/70 dark:shadow-none">
      <div className="grid grid-cols-3 items-end gap-3">
        {second ? (
          <SecondPlacePodiumColumn
            key={second.participant.participantId}
            avatarId={second.avatarId}
            currency={currency}
            currentParticipantId={currentParticipantId}
            entry={second}
          />
        ) : (
          <div />
        )}

        {first ? (
          <FirstPlacePodiumColumn
            key={first.participant.participantId}
            avatarId={first.avatarId}
            currency={currency}
            currentParticipantId={currentParticipantId}
            entry={first}
          />
        ) : (
          <div />
        )}

        {third ? (
          <ThirdPlacePodiumColumn
            key={third.participant.participantId}
            avatarId={third.avatarId}
            currency={currency}
            currentParticipantId={currentParticipantId}
            entry={third}
          />
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function FirstPlacePodiumColumn({
  avatarId,
  currency,
  currentParticipantId,
  entry,
}: {
  avatarId?: PartyParticipant["avatarId"] | null;
  currency: ComponentProps<typeof CurrencyText>["currency"];
  currentParticipantId: PartyParticipant["id"];
  entry: StatsPodiumEntry;
}) {
  return (
    <StatsPodiumColumnShell
      amountClassName="text-2xl"
      avatarClassName="h-16 w-16 text-base ring-white/25"
      avatarId={avatarId}
      currency={currency}
      currentParticipantId={currentParticipantId}
      entry={entry}
      iconName="#lucide/trophy"
      nameClassName="text-xl"
      pedestalClassName="min-h-40 border-yellow-300/70 bg-gradient-to-t from-yellow-500 via-amber-400 to-yellow-300 text-yellow-950 dark:border-yellow-500/60 dark:from-yellow-600 dark:via-amber-500 dark:to-yellow-400"
      rankClassName="bg-yellow-400/20 text-yellow-100 dark:bg-yellow-400/15 dark:text-yellow-200"
    />
  );
}

function SecondPlacePodiumColumn({
  avatarId,
  currency,
  currentParticipantId,
  entry,
}: {
  avatarId?: PartyParticipant["avatarId"] | null;
  currency: ComponentProps<typeof CurrencyText>["currency"];
  currentParticipantId: PartyParticipant["id"];
  entry: StatsPodiumEntry;
}) {
  return (
    <StatsPodiumColumnShell
      amountClassName="text-lg"
      avatarClassName="h-14 w-14 text-sm ring-accent-200 dark:ring-accent-700"
      avatarId={avatarId}
      currency={currency}
      currentParticipantId={currentParticipantId}
      entry={entry}
      iconName="#lucide/scale"
      nameClassName="text-lg"
      pedestalClassName="min-h-32 border-accent-300 bg-gradient-to-t from-accent-300 to-accent-100 text-accent-950 dark:border-accent-700 dark:from-accent-800 dark:to-accent-700 dark:text-accent-50"
      rankClassName="bg-accent-200 text-accent-700 dark:bg-accent-800 dark:text-accent-200"
    />
  );
}

function ThirdPlacePodiumColumn({
  avatarId,
  currency,
  currentParticipantId,
  entry,
}: {
  avatarId?: PartyParticipant["avatarId"] | null;
  currency: ComponentProps<typeof CurrencyText>["currency"];
  currentParticipantId: PartyParticipant["id"];
  entry: StatsPodiumEntry;
}) {
  return (
    <StatsPodiumColumnShell
      amountClassName="text-lg"
      avatarClassName="h-14 w-14 text-sm ring-accent-200 dark:ring-accent-700"
      avatarId={avatarId}
      currency={currency}
      currentParticipantId={currentParticipantId}
      entry={entry}
      iconName="#lucide/scale"
      nameClassName="text-lg"
      pedestalClassName="min-h-24 border-orange-300/70 bg-gradient-to-t from-orange-300 to-amber-100 text-orange-950 dark:border-orange-700 dark:from-orange-900 dark:to-amber-800 dark:text-amber-50"
      rankClassName="bg-accent-200 text-accent-700 dark:bg-accent-800 dark:text-accent-200"
    />
  );
}

function StatsPodiumColumnShell({
  avatarId,
  currency,
  currentParticipantId,
  entry,
  amountClassName,
  avatarClassName,
  iconName,
  nameClassName,
  pedestalClassName,
  rankClassName,
}: {
  avatarId?: PartyParticipant["avatarId"] | null;
  currency: ComponentProps<typeof CurrencyText>["currency"];
  currentParticipantId: PartyParticipant["id"];
  entry: StatsPodiumEntry;
  amountClassName: string;
  avatarClassName: string;
  iconName: ComponentProps<typeof Icon>["name"];
  nameClassName: string;
  pedestalClassName: string;
  rankClassName: string;
}) {
  const { participant, rank, shareOfTotal } = entry;
  const isCurrentParticipant =
    participant.participantId === currentParticipantId;
  const nameSizeClassName = getRankingNameClassName(participant.name, "podium");
  const amountSizeClassName = getRankingAmountClassName(
    participant.totalSpent,
    rank === 1 ? "winner" : "podium",
  );

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
          rankClassName,
        )}
      >
        #{rank}
      </div>

      <StatsParticipantAvatar
        avatarId={avatarId}
        badge={
          isCurrentParticipant ? (
            <StatsAvatarBadge tone="accent">{t`Me`}</StatsAvatarBadge>
          ) : null
        }
        className={cn("relative z-10 mt-3 ring-4 ring-inset", avatarClassName)}
        name={participant.name}
      />

      <div className="mt-3 min-w-0">
        <div className="flex flex-wrap items-center justify-center">
          <span
            className={cn(
              "truncate font-semibold tracking-tight text-accent-950 dark:text-accent-50",
              nameClassName,
              nameSizeClassName,
            )}
          >
            {participant.name}
          </span>
        </div>

        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-700 dark:text-accent-300">
          {formatPercent(shareOfTotal)}
        </div>
      </div>

      <div
        className={cn(
          "mt-4 flex w-full flex-col items-center justify-end rounded-t-[1.75rem] border border-b-0 px-3 pb-4 pt-5 text-center shadow-sm dark:shadow-none",
          pedestalClassName,
        )}
      >
        <Icon name={iconName} className="mb-2 size-5" />

        <CurrencyText
          amount={participant.totalSpent}
          currency={currency}
          className={cn(
            "font-semibold tracking-tight",
            amountClassName,
            amountSizeClassName,
          )}
          variant="inherit"
        />
      </div>
    </div>
  );
}

function StatsParticipantRow({
  avatarId,
  currency,
  participant,
  currentParticipantId,
  totalSpent,
  rank,
}: StatsParticipantRowProps) {
  const isCurrentParticipant =
    participant.participantId === currentParticipantId;
  const nameSizeClassName = getRankingNameClassName(participant.name, "list");
  const amountSizeClassName = getRankingAmountClassName(
    participant.totalSpent,
    "list",
  );

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border p-4 shadow-sm dark:shadow-none",
        isCurrentParticipant
          ? "border-accent-300 bg-accent-50/80 dark:border-accent-600 dark:bg-accent-900"
          : "border-accent-200/80 bg-white/80 dark:border-accent-800 dark:bg-accent-950/70",
      )}
    >
      <div className="flex items-start gap-4">
        <StatsParticipantAvatar
          avatarId={avatarId}
          badge={<StatsAvatarBadge>#{rank}</StatsAvatarBadge>}
          className="h-10 w-10 flex-shrink-0 text-xs ring-2 ring-inset ring-accent-200 dark:ring-accent-700"
          name={participant.name}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "truncate font-semibold text-accent-950 dark:text-accent-50",
                    nameSizeClassName,
                  )}
                >
                  {participant.name}
                </span>

                {isCurrentParticipant ? (
                  <span className="rounded-full bg-accent-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-50">
                    {t`Me`}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-accent-700 dark:text-accent-300">
                <span className="rounded-full bg-accent-100 px-2 py-1 dark:bg-accent-800">
                  {formatPercent(
                    totalSpent > 0 ? participant.totalSpent / totalSpent : 0,
                  )}
                </span>
                <span>
                  <Trans>of total spending</Trans>
                </span>
              </div>
            </div>

            <CurrencyText
              amount={participant.totalSpent}
              currency={currency}
              className={cn("font-semibold", amountSizeClassName)}
              variant="inherit"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsParticipantAvatar({
  avatarId,
  name,
  className,
  badge,
}: {
  avatarId?: PartyParticipant["avatarId"] | null;
  name: string;
  className?: string;
  badge?: ReactNode;
}) {
  const avatar = avatarId ? (
    <Suspense fallback={<Avatar className={className} name={name} />}>
      <StatsParticipantAvatarImage
        avatarId={avatarId}
        className={className}
        name={name}
      />
    </Suspense>
  ) : (
    <Avatar className={className} name={name} />
  );

  if (!badge) {
    return avatar;
  }

  return (
    <div className="relative inline-flex flex-shrink-0">
      {avatar}
      <div className="absolute -bottom-1 -right-1 z-20">{badge}</div>
    </div>
  );
}

function StatsParticipantAvatarImage({
  avatarId,
  name,
  className,
}: {
  avatarId: NonNullable<PartyParticipant["avatarId"]>;
  name: string;
  className?: string;
}) {
  const { url } = useMediaFile(avatarId);

  return <Avatar className={className} name={name} url={url} />;
}

function StatsAvatarBadge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "accent" | "default";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] shadow-sm",
        tone === "accent"
          ? "border-accent-200 bg-accent-500 text-accent-50 dark:border-accent-700"
          : "border-white bg-accent-950 text-accent-50 dark:border-accent-700 dark:bg-accent-100 dark:text-accent-950",
      )}
    >
      {children}
    </span>
  );
}

function CompactRangePicker({ value, onChange }: CompactRangePickerProps) {
  return (
    <PopoverTrigger>
      <Button
        color="input-like"
        className="h-9 w-full gap-2 rounded-full px-3 text-sm font-medium sm:w-auto"
      >
        <Icon
          name="#lucide/calendar"
          className="size-4 shrink-0 text-accent-600 dark:text-accent-300"
        />
        <span className="truncate">{formatRangeLabel(value)}</span>
      </Button>

      <Popover className="w-auto p-2" placement="bottom end">
        <PopoverDialog className="p-2">
          <RangeCalendar
            aria-label={t({
              comment:
                "Label for the custom range calendar popover on the party stats screen",
              message: "Custom range",
            })}
            value={value}
            onChange={(nextRange) => {
              if (!nextRange.start || !nextRange.end) {
                return;
              }

              onChange({
                start: nextRange.start,
                end: nextRange.end,
              });
            }}
          >
            <CalendarHeading />
            <CalendarGrid>
              <CalendarGridHeader>
                {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <CalendarCell date={date} />}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
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

function getStatsTimeframe(
  timeframeKey: PartyStatsTimeframeKey,
  customRange: StatsCustomRange,
  timezone: string,
): PartyStatsTimeframe {
  switch (timeframeKey) {
    case "all-time":
    case "current-month":
    case "current-year":
      return timeframeKey;
    case "custom-range":
      return {
        type: "custom-range",
        start: customRange.start.toDate(timezone),
        end: customRange.end.toDate(timezone),
      };
    default:
      return {
        type: "calendar-year",
        year: Number.parseInt(timeframeKey.replace("year:", ""), 10),
      };
  }
}

function getDefaultCustomRange({
  locale,
  timezone,
}: {
  locale: string;
  timezone: string;
}): StatsCustomRange {
  const currentDay = today(timezone);

  return {
    start: startOfWeek(currentDay, locale),
    end: endOfWeek(currentDay, locale),
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRangeLabel(range: StatsCustomRange) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  });

  const sameYear = range.start.year === range.end.year;
  const startDate = new Date(
    range.start.year,
    range.start.month - 1,
    range.start.day,
  );
  const endDate = new Date(range.end.year, range.end.month - 1, range.end.day);
  const startLabel = formatter.format(startDate);
  const endFormatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? { year: "numeric" as const } : {}),
  });
  const endLabel = endFormatter.format(endDate);

  if (sameYear) {
    return `${startLabel} - ${endLabel}`;
  }

  return `${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(startDate)} - ${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(endDate)}`;
}
