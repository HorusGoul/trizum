import { getExpenseTotalAmount, type Expense } from "#src/models/expense.js";
import type { PartyParticipant } from "#src/models/party.js";

export type PartyStatsTimeframePreset =
  | "all-time"
  | "last-year"
  | "current-year"
  | "current-month";

export interface PartyStatsCalendarYearTimeframe {
  type: "calendar-year";
  year: number;
}

export interface PartyStatsCustomRangeTimeframe {
  type: "custom-range";
  start: Date;
  end: Date;
}

export type PartyStatsTimeframe =
  | PartyStatsTimeframePreset
  | PartyStatsCalendarYearTimeframe
  | PartyStatsCustomRangeTimeframe;

export interface PartyStatsDateBounds {
  start: Date;
  end: Date;
}

export interface PartyStatsParticipantStat {
  participantId: PartyParticipant["id"];
  name: string;
  isArchived: boolean;
  totalSpent: number;
  expenseCount: number;
}

export interface PartyStatsResult {
  timeframe: PartyStatsTimeframe;
  totalSpent: number;
  totalExpenseCount: number;
  spendingParticipantCount: number;
  participantStats: PartyStatsParticipantStat[];
  ranking: PartyStatsParticipantStat[];
  topSpender: PartyStatsParticipantStat | null;
}

interface CalculatePartyStatsOptions {
  expenses: Expense[];
  participants: Record<PartyParticipant["id"], PartyParticipant>;
  timeframe: PartyStatsTimeframe;
  now?: Date;
}

interface PartyStatsExpenseDatesOptions {
  expenses: Pick<Expense, "isTransfer" | "paidAt">[];
  now?: Date;
}

export function calculatePartyStats({
  expenses,
  participants,
  timeframe,
  now = new Date(),
}: CalculatePartyStatsOptions): PartyStatsResult {
  const participantStatsById = Object.fromEntries(
    Object.values(participants).map((participant) => [
      participant.id,
      createParticipantStat(participant),
    ]),
  ) as Record<PartyParticipant["id"], PartyStatsParticipantStat>;

  let totalSpent = 0;
  let totalExpenseCount = 0;

  for (const expense of expenses) {
    if (
      expense.isTransfer ||
      !isExpenseWithinTimeframe(expense, timeframe, now)
    ) {
      continue;
    }

    totalSpent += getExpenseTotalAmount(expense);
    totalExpenseCount += 1;

    for (const [participantId, amount] of Object.entries(expense.paidBy)) {
      const existingParticipant = participants[participantId];
      const participantStat =
        participantStatsById[participantId] ??
        createParticipantStat(
          existingParticipant ?? {
            id: participantId,
            name: participantId,
          },
        );

      participantStat.totalSpent += amount;
      participantStat.expenseCount += 1;
      participantStatsById[participantId] = participantStat;
    }
  }

  const participantStats = [...Object.values(participantStatsById)].sort(
    compareParticipantStats,
  );
  const ranking = participantStats.filter(
    (participant) => participant.totalSpent > 0,
  );

  return {
    timeframe,
    totalSpent,
    totalExpenseCount,
    spendingParticipantCount: ranking.length,
    participantStats,
    ranking,
    topSpender: ranking.at(0) ?? null,
  };
}

export function getPartyStatsAvailablePastYears({
  expenses,
  now = new Date(),
}: PartyStatsExpenseDatesOptions) {
  const currentYear = now.getFullYear();
  const years = new Set<number>();

  for (const expense of expenses) {
    if (expense.isTransfer) {
      continue;
    }

    const year = expense.paidAt.getFullYear();

    if (year < currentYear) {
      years.add(year);
    }
  }

  return [...years].sort((left, right) => right - left);
}

export function getPartyStatsDateBounds(
  expenses: Pick<Expense, "isTransfer" | "paidAt">[],
): PartyStatsDateBounds | null {
  let earliestExpense: Date | null = null;
  let latestExpense: Date | null = null;

  for (const expense of expenses) {
    if (expense.isTransfer) {
      continue;
    }

    if (
      earliestExpense === null ||
      expense.paidAt.getTime() < earliestExpense.getTime()
    ) {
      earliestExpense = expense.paidAt;
    }

    if (
      latestExpense === null ||
      expense.paidAt.getTime() > latestExpense.getTime()
    ) {
      latestExpense = expense.paidAt;
    }
  }

  if (earliestExpense === null || latestExpense === null) {
    return null;
  }

  return {
    start: earliestExpense,
    end: latestExpense,
  };
}

function createParticipantStat(
  participant: Pick<PartyParticipant, "id" | "name" | "isArchived">,
): PartyStatsParticipantStat {
  return {
    participantId: participant.id,
    name: participant.name,
    isArchived: participant.isArchived ?? false,
    totalSpent: 0,
    expenseCount: 0,
  };
}

function compareParticipantStats(
  left: PartyStatsParticipantStat,
  right: PartyStatsParticipantStat,
) {
  if (left.totalSpent !== right.totalSpent) {
    return right.totalSpent - left.totalSpent;
  }

  return left.name.localeCompare(right.name);
}

function isExpenseWithinTimeframe(
  expense: Pick<Expense, "paidAt">,
  timeframe: PartyStatsTimeframe,
  now: Date,
) {
  if (timeframe === "all-time") {
    return true;
  }

  const expenseTimestamp = expense.paidAt.getTime();
  const range = getTimeframeRange(timeframe, now);

  return (
    expenseTimestamp >= range.start.getTime() &&
    expenseTimestamp < range.end.getTime()
  );
}

function getTimeframeRange(timeframe: PartyStatsTimeframe, now: Date) {
  if (typeof timeframe !== "string") {
    if (timeframe.type === "calendar-year") {
      return {
        start: new Date(timeframe.year, 0, 1),
        end: new Date(timeframe.year + 1, 0, 1),
      };
    }

    const [start, end] =
      timeframe.start.getTime() <= timeframe.end.getTime()
        ? [timeframe.start, timeframe.end]
        : [timeframe.end, timeframe.start];
    const normalizedStart = startOfDay(start);
    const normalizedEnd = startOfDay(end);

    return {
      start: normalizedStart,
      end: addDays(normalizedEnd, 1),
    };
  }

  switch (timeframe) {
    case "current-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    case "current-year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      };
    case "last-year":
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear(), 0, 1),
      };
    case "all-time":
      return {
        start: new Date(0),
        end: new Date(Number.MAX_SAFE_INTEGER),
      };
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
