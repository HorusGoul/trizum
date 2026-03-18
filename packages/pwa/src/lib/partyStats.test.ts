import { describe, expect, test } from "vitest";
import type { Expense } from "#src/models/expense.js";
import type { PartyParticipant } from "#src/models/party.js";
import {
  calculatePartyStats,
  getPartyStatsAvailablePastYears,
  getPartyStatsDateBounds,
} from "./partyStats";

const participants = {
  alice: {
    id: "alice",
    name: "Alice",
  },
  bob: {
    id: "bob",
    name: "Bob",
  },
  carol: {
    id: "carol",
    name: "Carol",
  },
  dave: {
    id: "dave",
    name: "Dave",
  },
} satisfies Record<string, PartyParticipant>;

const referenceDate = new Date("2026-03-17T12:00:00.000Z");

describe("calculatePartyStats", () => {
  test("aggregates group totals and rankings while excluding transfer expenses", () => {
    const stats = calculatePartyStats({
      expenses: createFixtureExpenses(),
      participants,
      timeframe: "all-time",
      now: referenceDate,
    });

    expect(stats.totalSpent).toBe(1050);
    expect(stats.totalExpenseCount).toBe(4);
    expect(stats.spendingParticipantCount).toBe(3);
    expect(stats.topSpender?.participantId).toBe("alice");

    expect(
      stats.participantStats.map((participant) => ({
        participantId: participant.participantId,
        totalSpent: participant.totalSpent,
        expenseCount: participant.expenseCount,
      })),
    ).toEqual([
      {
        participantId: "alice",
        totalSpent: 500,
        expenseCount: 2,
      },
      {
        participantId: "carol",
        totalSpent: 300,
        expenseCount: 1,
      },
      {
        participantId: "bob",
        totalSpent: 250,
        expenseCount: 1,
      },
      {
        participantId: "dave",
        totalSpent: 0,
        expenseCount: 0,
      },
    ]);
  });

  test("filters stats by calendar timeframe boundaries", () => {
    const expenses = createFixtureExpenses();

    const currentMonth = calculatePartyStats({
      expenses,
      participants,
      timeframe: "current-month",
      now: referenceDate,
    });
    expect(currentMonth.totalSpent).toBe(100);
    expect(currentMonth.totalExpenseCount).toBe(1);
    expect(
      currentMonth.ranking.map((participant) => participant.participantId),
    ).toEqual(["alice"]);

    const currentYear = calculatePartyStats({
      expenses,
      participants,
      timeframe: "current-year",
      now: referenceDate,
    });
    expect(currentYear.totalSpent).toBe(350);
    expect(currentYear.totalExpenseCount).toBe(2);

    const lastYear = calculatePartyStats({
      expenses,
      participants,
      timeframe: "last-year",
      now: referenceDate,
    });
    expect(lastYear.totalSpent).toBe(300);
    expect(lastYear.totalExpenseCount).toBe(1);
    expect(lastYear.topSpender?.participantId).toBe("carol");
  });

  test("supports filtering a specific past year", () => {
    const stats = calculatePartyStats({
      expenses: createFixtureExpenses(),
      participants,
      timeframe: { type: "calendar-year", year: 2024 },
      now: referenceDate,
    });

    expect(stats.totalSpent).toBe(400);
    expect(stats.totalExpenseCount).toBe(1);
    expect(stats.topSpender?.participantId).toBe("alice");
  });

  test("supports inclusive custom date ranges", () => {
    const stats = calculatePartyStats({
      expenses: createFixtureExpenses(),
      participants,
      timeframe: {
        type: "custom-range",
        start: new Date("2026-03-05T23:59:59.000Z"),
        end: new Date("2026-01-15T00:00:00.000Z"),
      },
      now: referenceDate,
    });

    expect(stats.totalSpent).toBe(350);
    expect(stats.totalExpenseCount).toBe(2);
    expect(
      stats.ranking.map((participant) => participant.participantId),
    ).toEqual(["bob", "alice"]);
  });

  test("lists the available past years and tracked bounds", () => {
    const expenses = createFixtureExpenses();

    expect(
      getPartyStatsAvailablePastYears({
        expenses,
        now: referenceDate,
      }),
    ).toEqual([2025, 2024]);

    expect(getPartyStatsDateBounds(expenses)).toEqual({
      start: new Date("2024-10-01T12:00:00.000Z"),
      end: new Date("2026-03-05T12:00:00.000Z"),
    });
  });
});

function createFixtureExpenses(): Expense[] {
  return [
    createExpense({
      id: "expense-1",
      name: "March groceries",
      paidAt: "2026-03-05T12:00:00.000Z",
      paidBy: { alice: 100 },
    }),
    createExpense({
      id: "expense-2",
      name: "January hotel",
      paidAt: "2026-01-15T12:00:00.000Z",
      paidBy: { bob: 250 },
    }),
    createExpense({
      id: "expense-3",
      name: "Summer dinner",
      paidAt: "2025-07-10T12:00:00.000Z",
      paidBy: { carol: 300 },
    }),
    createExpense({
      id: "expense-4",
      name: "Autumn train",
      paidAt: "2024-10-01T12:00:00.000Z",
      paidBy: { alice: 400 },
    }),
    createExpense({
      id: "expense-5",
      name: "Settlement transfer",
      paidAt: "2026-03-08T12:00:00.000Z",
      paidBy: { bob: 500 },
      isTransfer: true,
    }),
  ];
}

function createExpense({
  id,
  name,
  paidAt,
  paidBy,
  isTransfer = false,
}: {
  id: string;
  name: string;
  paidAt: string;
  paidBy: Record<string, number>;
  isTransfer?: boolean;
}): Expense {
  return {
    id,
    name,
    paidAt: new Date(paidAt),
    paidBy,
    shares: {},
    photos: [],
    isTransfer,
    __hash: id,
  };
}
