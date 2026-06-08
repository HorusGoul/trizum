import { describe, expect, test } from "vite-plus/test";
import { getExpenseUnitShares } from "#src/models/expense.ts";
import { parseTricountData, type TricountResponse } from "./tricountMigration.ts";

describe("parseTricountData", () => {
  test("preserves Tricount ratio allocations as divide part counts", () => {
    const data = createTricountResponse();

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

function createTricountResponse(): TricountResponse {
  return {
    Response: [
      {
        Registry: {
          id: 1,
          title: "Issue 162",
          description: null,
          currency: "EUR",
          memberships: [createMembership(1, "Mario"), createMembership(2, "Horus")],
          all_registry_entry: [
            {
              RegistryEntry: {
                id: 100,
                amount: {
                  currency: "EUR",
                  value: "49.45",
                },
                description: "por partes",
                date: "2024-10-01",
                type_transaction: "EXPENSE",
                membership_owned: {
                  RegistryMembershipNonUser: {
                    alias: {
                      display_name: "Mario",
                    },
                  },
                },
                allocations: [
                  createRatioAllocation("Horus", "28.26", 4),
                  createRatioAllocation("Mario", "21.19", 3),
                ],
                attachment: [],
                category: "general",
              },
            },
          ],
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

function createMembership(id: number, name: string) {
  return {
    RegistryMembershipNonUser: {
      id,
      alias: {
        display_name: name,
      },
    },
  };
}

function createRatioAllocation(name: string, value: string, shareRatio: number) {
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
    type: "RATIO",
    share_ratio: shareRatio,
  };
}
