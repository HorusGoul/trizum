interface Party {
  type: "party";
  name: string;
  description: string;
  currency: string;
  hue?: number;
  participants: Record<string, PartyParticipant>;
}

interface PartyParticipant {
  id: string;
  name: string;
  phone?: string;
  avatarId?: string | null;
  isArchived?: boolean;
  personalMode?: boolean;
}

interface Expense {
  id: string;
  name: string;
  paidAt: Date;
  paidBy: Record<string, number>;
  shares: Record<string, ExpenseShare>;
  photos: string[];
  isTransfer?: boolean;
  __hash: string;
  __editCopy?: Omit<Expense, "__editCopy">;
  __editCopyLastUpdatedAt?: Date;
}

export type ExpenseShare = ExpenseShareExact | ExpenseShareDivide;

export interface ExpenseShareExact {
  type: "exact";
  value: number;
}

export interface ExpenseParticipantPresence {
  participantId: PartyParticipant["id"];
  dateTime: Date;
  elementId: string;
}

export interface ExpenseShareDivide {
  type: "divide";
  value: number;
  calculatedExact?: number;
}

interface MigrationData {
  party: Omit<Party, "id" | "chunkRefs">;
  expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[];
  photos: { id: string; url: string }[];
}

export const migrationData: MigrationData = {
  party: {
    type: "party",
    name: "Andalusian Point",
    description: "Trip to the best place in the world",
    currency: "EUR",
    participants: {
      "1": {
        id: "1",
        name: "Modest",
      },
      "2": {
        id: "2",
        name: "John",
      },
      "3": {
        id: "3",
        name: "Joseph Ann",
      },
      "4": {
        id: "4",
        name: "Luigi",
      },
      "5": {
        id: "5",
        name: "Dr. Moñas",
      },
      "6": {
        id: "6",
        name: "Horace",
      },
    },
  },
  expenses: [
    {
      name: "Pizza",
      paidAt: new Date("2025-02-27").toISOString(),
      paidBy: {
        "1": 7850,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Beers at La Bodega",
      paidAt: new Date("2025-02-27").toISOString(),
      paidBy: {
        "2": 3640,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Gas - Seville to Cádiz",
      paidAt: new Date("2025-02-28").toISOString(),
      paidBy: {
        "3": 6520,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Supermarket groceries",
      paidAt: new Date("2025-02-28").toISOString(),
      paidBy: {
        "4": 8745,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Craft beer tasting",
      paidAt: new Date("2025-02-28").toISOString(),
      paidBy: {
        "5": 4800,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Tapas dinner",
      paidAt: new Date("2025-02-28").toISOString(),
      paidBy: {
        "6": 12350,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Gas - Cádiz to Málaga",
      paidAt: new Date("2025-03-01").toISOString(),
      paidBy: {
        "1": 5890,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Breakfast pastries",
      paidAt: new Date("2025-03-01").toISOString(),
      paidBy: {
        "2": 2180,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Beers at the beach bar",
      paidAt: new Date("2025-03-01").toISOString(),
      paidBy: {
        "3": 2950,
      },
      shares: {
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Seafood paella",
      paidAt: new Date("2025-03-01").toISOString(),
      paidBy: {
        "4": 9600,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Gas station snacks",
      paidAt: new Date("2025-03-02").toISOString(),
      paidBy: {
        "5": 1475,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Gas - Málaga to Granada",
      paidAt: new Date("2025-03-02").toISOString(),
      paidBy: {
        "6": 4380,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Cervecería rounds",
      paidAt: new Date("2025-03-02").toISOString(),
      paidBy: {
        "1": 5120,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Grilled meat dinner",
      paidAt: new Date("2025-03-02").toISOString(),
      paidBy: {
        "2": 11480,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Late night beers",
      paidAt: new Date("2025-03-02").toISOString(),
      paidBy: {
        "3": 2240,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Breakfast churros",
      paidAt: new Date("2025-03-03").toISOString(),
      paidBy: {
        "4": 1890,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Gas - Granada return",
      paidAt: new Date("2025-03-03").toISOString(),
      paidBy: {
        "5": 7250,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Highway snacks & drinks",
      paidAt: new Date("2025-03-03").toISOString(),
      paidBy: {
        "6": 2365,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Final beers at the airport",
      paidAt: new Date("2025-03-03").toISOString(),
      paidBy: {
        "1": 3680,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
      },
      photos: [],
    },
    {
      name: "Sandwiches for the road",
      paidAt: new Date("2025-03-04").toISOString(),
      paidBy: {
        "2": 4250,
      },
      shares: {
        "1": { type: "divide", value: 1 },
        "2": { type: "divide", value: 1 },
        "3": { type: "divide", value: 1 },
        "4": { type: "divide", value: 1 },
        "5": { type: "divide", value: 1 },
        "6": { type: "divide", value: 1 },
      },
      photos: [],
    },
  ],
  photos: [],
};
