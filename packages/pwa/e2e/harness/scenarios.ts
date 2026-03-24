export const defaultParticipants = {
  alex: {
    id: "participant-alex",
    name: "Alex",
  },
  blair: {
    id: "participant-blair",
    name: "Blair",
  },
  casey: {
    id: "participant-casey",
    name: "Casey",
  },
} as const;

export const createPartyActivationScenario = {
  partyName: "Harness road trip",
  participants: ["Morgan", "Riley", "Taylor"],
  selectedParticipantName: "Riley",
} as const;

export const expenseEntryJourney = {
  selectedParticipantName: defaultParticipants.blair.name,
  title: "Harness coffee run",
  amount: 42.5,
  participantNames: [
    defaultParticipants.blair.name,
    defaultParticipants.casey.name,
  ],
} as const;

export const expenseLogJourney = {
  expenseCount: 503,
  seededExpenseAmountCents: 1234,
  selectedParticipantName: defaultParticipants.blair.name,
  memberParticipantId: defaultParticipants.blair.id,
  newExpenseTitle: "Late checkout snacks",
} as const;

export function createPartyFixture() {
  return {
    party: {
      type: "party" as const,
      name: "Weekend trip",
      symbol: "🏕️",
      description: "Shared costs for the lake house weekend.",
      currency: "EUR" as const,
      participants: {
        [defaultParticipants.alex.id]: {
          ...defaultParticipants.alex,
        },
        [defaultParticipants.blair.id]: {
          ...defaultParticipants.blair,
        },
        [defaultParticipants.casey.id]: {
          ...defaultParticipants.casey,
        },
      },
    },
    expenses: [],
    photos: [],
  };
}

export function createImbalancedPartyFixture() {
  return {
    ...createPartyFixture(),
    expenses: [
      {
        name: "Cabin groceries",
        paidAt: "2026-02-14T18:30:00.000Z",
        paidBy: {
          [defaultParticipants.alex.id]: 9000,
        },
        shares: {
          [defaultParticipants.alex.id]: {
            type: "divide" as const,
            value: 1,
          },
          [defaultParticipants.blair.id]: {
            type: "divide" as const,
            value: 1,
          },
          [defaultParticipants.casey.id]: {
            type: "divide" as const,
            value: 1,
          },
        },
        photos: [],
      },
    ],
  };
}

export function createSettlementPartyFixture() {
  return {
    ...createPartyFixture(),
    expenses: [
      {
        name: "Cabin groceries",
        paidAt: "2026-02-14T18:30:00.000Z",
        paidBy: {
          [defaultParticipants.alex.id]: 6000,
        },
        shares: {
          [defaultParticipants.alex.id]: {
            type: "divide" as const,
            value: 1,
          },
          [defaultParticipants.blair.id]: {
            type: "divide" as const,
            value: 1,
          },
        },
        photos: [],
      },
    ],
  };
}

export function createExpenseLogTitle(index: number) {
  return `Seeded expense ${String(index).padStart(3, "0")}`;
}

export function createExpenseLogFixture(
  expenseCount = expenseLogJourney.expenseCount,
) {
  return {
    ...createPartyFixture(),
    expenses: Array.from({ length: expenseCount }, (_, index) => ({
      name: createExpenseLogTitle(index),
      paidAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
      paidBy: {
        [defaultParticipants.alex.id]:
          expenseLogJourney.seededExpenseAmountCents,
      },
      shares: {
        [defaultParticipants.alex.id]: {
          type: "divide" as const,
          value: 1,
        },
        [defaultParticipants.blair.id]: {
          type: "divide" as const,
          value: 1,
        },
        [defaultParticipants.casey.id]: {
          type: "divide" as const,
          value: 1,
        },
      },
      photos: [],
    })),
  };
}
