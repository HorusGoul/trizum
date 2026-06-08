import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { getExpenseUnitShares } from "#src/models/expense.ts";
import { parseTricountData, type TricountResponse } from "./tricountMigration.ts";

const warningRecords = vi.hoisted(
  () =>
    [] as Array<{
      message: string;
      properties?: Record<string, unknown>;
    }>,
);

vi.mock("#src/lib/log.ts", () => ({
  getLogger: () => ({
    debug() {},
    error() {},
    info() {},
    warning(message: string, properties?: Record<string, unknown>) {
      warningRecords.push({ message, properties });
    },
  }),
}));

describe("parseTricountData", () => {
  afterEach(() => {
    warningRecords.length = 0;
  });

  test("preserves Tricount ratio allocations as divide part counts", () => {
    const data = createTricountResponse({
      title: "Issue 162",
      memberships: [createMembership(1, "Mario"), createMembership(2, "Horus")],
      entries: [
        createEntry({
          id: 100,
          amount: "49.45",
          description: "por partes",
          paidBy: "Mario",
          allocations: [
            createRatioAllocation("Horus", "28.26", 4),
            createRatioAllocation("Mario", "21.19", 3),
          ],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const expense = migrationData.expenses[0]!;
    const horusId = getParticipantIdByName(migrationData.party.participants, "Horus");
    const marioId = getParticipantIdByName(migrationData.party.participants, "Mario");

    expect(expense.name).toBe("por partes");
    expect(expense.paidBy).toStrictEqual({ [marioId]: 4945 });
    expect(expense.shares[horusId]).toStrictEqual({ type: "divide", value: 4 });
    expect(expense.shares[marioId]).toStrictEqual({ type: "divide", value: 3 });

    expect(getExpenseUnitShares(expense)).toStrictEqual({
      [horusId]: 2826,
      [marioId]: 2119,
    });
  });

  test("defaults ratio allocations without explicit share ratios to one part each", () => {
    const data = createTricountResponse({
      memberships: [
        createMembership(1, "Alice"),
        createMembership(2, "Bob"),
        createMembership(3, "Cora"),
      ],
      entries: [
        createEntry({
          id: 101,
          amount: "12.00",
          description: "shared lunch",
          paidBy: "Alice",
          allocations: [
            createRatioAllocation("Alice", "4.00"),
            createRatioAllocation("Bob", "4.00"),
            createRatioAllocation("Cora", "4.00"),
          ],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const expense = migrationData.expenses[0]!;
    const aliceId = getParticipantIdByName(migrationData.party.participants, "Alice");
    const bobId = getParticipantIdByName(migrationData.party.participants, "Bob");
    const coraId = getParticipantIdByName(migrationData.party.participants, "Cora");

    expect(expense.shares).toStrictEqual({
      [aliceId]: { type: "divide", value: 1 },
      [bobId]: { type: "divide", value: 1 },
      [coraId]: { type: "divide", value: 1 },
    });
    expect(getExpenseUnitShares(expense)).toStrictEqual({
      [aliceId]: 400,
      [bobId]: 400,
      [coraId]: 400,
    });
  });

  test("preserves mixed exact amount and ratio allocations on one expense", () => {
    const data = createTricountResponse({
      memberships: [
        createMembership(1, "Alice"),
        createMembership(2, "Bob"),
        createMembership(3, "Cora"),
      ],
      entries: [
        createEntry({
          id: 102,
          amount: "40.00",
          description: "groceries",
          paidBy: "Alice",
          allocations: [
            createAmountAllocation("Alice", "10.00"),
            createRatioAllocation("Bob", "10.00", 1),
            createRatioAllocation("Cora", "20.00", 2),
          ],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const expense = migrationData.expenses[0]!;
    const aliceId = getParticipantIdByName(migrationData.party.participants, "Alice");
    const bobId = getParticipantIdByName(migrationData.party.participants, "Bob");
    const coraId = getParticipantIdByName(migrationData.party.participants, "Cora");

    expect(expense.paidBy).toStrictEqual({ [aliceId]: 4000 });
    expect(expense.shares).toStrictEqual({
      [aliceId]: { type: "exact", value: 1000 },
      [bobId]: { type: "divide", value: 1 },
      [coraId]: { type: "divide", value: 2 },
    });
    expect(getExpenseUnitShares(expense)).toStrictEqual({
      [aliceId]: 1000,
      [bobId]: 1000,
      [coraId]: 2000,
    });
  });

  test("excludes zero-value amount allocations from shares", () => {
    const data = createTricountResponse({
      memberships: [createMembership(1, "Alice"), createMembership(2, "Bob")],
      entries: [
        createEntry({
          id: 103,
          amount: "12.00",
          description: "tickets",
          paidBy: "Alice",
          allocations: [
            createAmountAllocation("Alice", "0.00"),
            createAmountAllocation("Bob", "12.00"),
          ],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const expense = migrationData.expenses[0]!;
    const aliceId = getParticipantIdByName(migrationData.party.participants, "Alice");
    const bobId = getParticipantIdByName(migrationData.party.participants, "Bob");

    expect(expense.shares).not.toHaveProperty(aliceId);
    expect(expense.shares).toStrictEqual({
      [bobId]: { type: "exact", value: 1200 },
    });
  });

  test("marks balance transactions as transfers while preserving parsed amounts", () => {
    const data = createTricountResponse({
      memberships: [createMembership(1, "Alice"), createMembership(2, "Bob")],
      entries: [
        createEntry({
          id: 104,
          amount: "-25.50",
          description: "settlement",
          paidBy: "Bob",
          typeTransaction: "BALANCE",
          allocations: [createAmountAllocation("Alice", "-25.50")],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const expense = migrationData.expenses[0]!;
    const aliceId = getParticipantIdByName(migrationData.party.participants, "Alice");
    const bobId = getParticipantIdByName(migrationData.party.participants, "Bob");

    expect(expense.isTransfer).toBe(true);
    expect(expense.paidBy).toStrictEqual({ [bobId]: 2550 });
    expect(expense.shares).toStrictEqual({
      [aliceId]: { type: "exact", value: 2550 },
    });
  });

  test("deduplicates attachment URLs and maps photo IDs back to each expense", () => {
    const sharedUrl = "https://img.example.test/shared.jpg";
    const secondUrl = "https://img.example.test/second.jpg";
    const data = createTricountResponse({
      memberships: [createMembership(1, "Alice"), createMembership(2, "Bob")],
      entries: [
        createEntry({
          id: 105,
          amount: "10.00",
          description: "museum",
          paidBy: "Alice",
          allocations: [createAmountAllocation("Bob", "10.00")],
          attachment: [createAttachment(), createAttachment([]), createAttachment([sharedUrl])],
        }),
        createEntry({
          id: 106,
          amount: "5.00",
          description: "coffee",
          paidBy: "Bob",
          allocations: [createAmountAllocation("Alice", "5.00")],
          attachment: [createAttachment([sharedUrl]), createAttachment([secondUrl])],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const [firstExpense, secondExpense] = migrationData.expenses;
    const sharedPhoto = migrationData.photos.find((photo) => photo.url === sharedUrl);
    const secondPhoto = migrationData.photos.find((photo) => photo.url === secondUrl);

    expect(migrationData.photos).toHaveLength(2);
    expect(sharedPhoto).toBeDefined();
    expect(secondPhoto).toBeDefined();
    expect(firstExpense!.photos).toStrictEqual([sharedPhoto!.id]);
    expect(secondExpense!.photos).toStrictEqual([sharedPhoto!.id, secondPhoto!.id]);
  });

  test("warns and skips entries with missing payer or allocation participants", () => {
    const data = createTricountResponse({
      memberships: [createMembership(1, "Alice"), createMembership(2, "Bob")],
      entries: [
        createEntry({
          id: 107,
          amount: "10.00",
          description: "unknown payer",
          paidBy: "Charlie",
          allocations: [createAmountAllocation("Alice", "10.00")],
        }),
        createEntry({
          id: 108,
          amount: "8.00",
          description: "unknown participant",
          paidBy: "Alice",
          allocations: [
            createAmountAllocation("Dana", "3.00"),
            createAmountAllocation("Bob", "5.00"),
          ],
        }),
      ],
    });

    const migrationData = parseTricountData(data);
    const bobId = getParticipantIdByName(migrationData.party.participants, "Bob");

    expect(migrationData.expenses).toHaveLength(1);
    expect(migrationData.expenses[0]!.name).toBe("unknown participant");
    expect(migrationData.expenses[0]!.shares).toStrictEqual({
      [bobId]: { type: "exact", value: 500 },
    });
    expect(warningRecords).toStrictEqual([
      {
        message: "Could not find participant ID for payer {paidByName}",
        properties: { paidByName: "Charlie" },
      },
      {
        message: "Could not find participant ID for participant {participantName}",
        properties: { participantName: "Dana" },
      },
    ]);
  });
});

function getParticipantIdByName(
  participants: TricountResponseMigrationParticipants,
  name: string,
): string {
  const participantEntry = Object.entries(participants).find(
    ([, participant]) => participant.name === name,
  );

  if (!participantEntry) {
    throw new Error(`Expected participant ${name} to exist`);
  }

  return participantEntry[0];
}

type TricountResponseMigrationParticipants = ReturnType<
  typeof parseTricountData
>["party"]["participants"];

type TricountRegistry = TricountResponse["Response"][number]["Registry"];
type TricountMembership = TricountRegistry["memberships"][number];
type TricountEntry = TricountRegistry["all_registry_entry"][number]["RegistryEntry"];
type TricountAllocation = TricountEntry["allocations"][number];
type TricountAttachment = TricountEntry["attachment"][number];

function createTricountResponse({
  title = "Tricount import fixture",
  description = null,
  currency = "EUR",
  memberships,
  entries,
}: {
  title?: string;
  description?: string | null;
  currency?: string;
  memberships: TricountMembership[];
  entries: TricountEntry[];
}): TricountResponse {
  return {
    Response: [
      {
        Registry: {
          id: 1,
          title,
          description,
          currency,
          memberships,
          all_registry_entry: entries.map((entry) => ({ RegistryEntry: entry })),
        },
        Token: {
          token: "token",
        },
        UserPerson: {
          id: 1,
        },
      },
    ],
  };
}

function createEntry({
  id,
  amount,
  description,
  paidBy,
  allocations,
  typeTransaction = "EXPENSE",
  attachment = [],
  date = "2024-10-01",
  category = "general",
}: {
  id: number;
  amount: string;
  description: string;
  paidBy: string;
  allocations: TricountAllocation[];
  typeTransaction?: string;
  attachment?: TricountAttachment[];
  date?: string;
  category?: string;
}): TricountEntry {
  return {
    id,
    amount: {
      currency: "EUR",
      value: amount,
    },
    description,
    date,
    type_transaction: typeTransaction,
    membership_owned: {
      RegistryMembershipNonUser: {
        alias: {
          display_name: paidBy,
        },
      },
    },
    allocations,
    attachment,
    category,
  };
}

function createMembership(id: number, name: string): TricountMembership {
  return {
    RegistryMembershipNonUser: {
      id,
      alias: {
        display_name: name,
      },
    },
  };
}

function createAmountAllocation(name: string, value: string): TricountAllocation {
  return createAllocation(name, value, "AMOUNT");
}

function createRatioAllocation(
  name: string,
  value: string,
  shareRatio?: number,
): TricountAllocation {
  const allocation = createAllocation(name, value, "RATIO");

  if (shareRatio !== undefined) {
    allocation.share_ratio = shareRatio;
  }

  return allocation;
}

function createAllocation(
  name: string,
  value: string,
  type: TricountAllocation["type"],
): TricountAllocation {
  return {
    amount: {
      currency: "EUR",
      value,
    },
    membership: {
      RegistryMembershipNonUser: {
        alias: {
          display_name: name,
        },
      },
    },
    type,
  };
}

function createAttachment(urls?: string[]): TricountAttachment {
  return {
    urls: urls?.map((url) => ({ url })),
  };
}
