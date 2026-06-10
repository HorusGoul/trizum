export const defaultParticipants = {
  alex: {
    id: "0b2edc6a-e0e5-4bf9-9a18-b79c704cf1c5",
    name: "Alex",
  },
  blair: {
    id: "47e040e2-cff0-4f36-99eb-d459ab248141",
    name: "Blair",
  },
  casey: {
    id: "f86441af-6c5e-4ee8-97c8-30798aca6612",
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
  participantNames: [defaultParticipants.blair.name, defaultParticipants.casey.name],
} as const;

export const expenseLogJourney = {
  expenseCount: 503,
  seededExpenseAmountCents: 1234,
  selectedParticipantName: defaultParticipants.blair.name,
  memberParticipantId: defaultParticipants.blair.id,
  newExpenseTitle: "Late checkout snacks",
} as const;

export const debtTransferJourney = {
  originPartyName: "Weekend trip",
  destinationPartyName: "City break",
  originMemberParticipantId: defaultParticipants.blair.id,
  destinationMemberParticipant: {
    id: "c7d11a42-3288-4d6e-8553-99a2b9ea69b4",
    name: "Blair Downtown",
  },
  destinationCreditorParticipant: {
    id: "18870461-9483-4d7c-bf79-874867325f0a",
    name: "Alex Smith",
  },
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

export function createExpenseLogFixture(expenseCount: number = expenseLogJourney.expenseCount) {
  return {
    ...createPartyFixture(),
    expenses: Array.from({ length: expenseCount }, (_, index) => ({
      name: createExpenseLogTitle(index),
      paidAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
      paidBy: {
        [defaultParticipants.alex.id]: expenseLogJourney.seededExpenseAmountCents,
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

export function createDebtTransferDestinationFixture({
  includeCreditor = true,
  includeExtraParticipant = true,
}: {
  includeCreditor?: boolean;
  includeExtraParticipant?: boolean;
} = {}) {
  return {
    party: {
      type: "party" as const,
      name: debtTransferJourney.destinationPartyName,
      symbol: "🌆",
      description: "Costs for the city break.",
      currency: "EUR" as const,
      participants: {
        [debtTransferJourney.destinationMemberParticipant.id]: {
          ...debtTransferJourney.destinationMemberParticipant,
        },
        ...(includeCreditor
          ? {
              [debtTransferJourney.destinationCreditorParticipant.id]: {
                ...debtTransferJourney.destinationCreditorParticipant,
              },
            }
          : {}),
        ...(includeExtraParticipant
          ? {
              [defaultParticipants.casey.id]: {
                ...defaultParticipants.casey,
              },
            }
          : {}),
      },
    },
    expenses: [],
    photos: [],
  };
}
