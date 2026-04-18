import { describe, expect, test } from "vitest";
import {
  createDebtTransferExpenses,
  getDebtTransferParticipantMatch,
} from "./debtTransfer";

describe("createDebtTransferExpenses", () => {
  test("creates a settlement expense in the origin party and a new debt in the destination party", () => {
    const paidAt = new Date("2026-04-18T10:20:30.000Z");

    const { originExpense, destinationExpense } = createDebtTransferExpenses({
      amount: 4_000,
      originDebtorId: "me-origin",
      originCreditorId: "juan-origin",
      destinationDebtorId: "me-destination",
      destinationCreditorId: "juan-destination",
      paidAt,
      originExpenseName: "Debt transfer to another party",
      destinationExpenseName: "Debt transfer from another party",
    });

    expect(originExpense).toEqual({
      name: "Debt transfer to another party",
      paidAt,
      paidBy: {
        "me-origin": 4_000,
      },
      shares: {
        "juan-origin": {
          type: "divide",
          value: 1,
        },
      },
      photos: [],
      isTransfer: true,
    });

    expect(destinationExpense).toEqual({
      name: "Debt transfer from another party",
      paidAt,
      paidBy: {
        "juan-destination": 4_000,
      },
      shares: {
        "me-destination": {
          type: "divide",
          value: 1,
        },
      },
      photos: [],
      isTransfer: true,
    });
  });

  test("rejects non-positive transfer amounts", () => {
    expect(() =>
      createDebtTransferExpenses({
        amount: 0,
        originDebtorId: "me-origin",
        originCreditorId: "juan-origin",
        destinationDebtorId: "me-destination",
        destinationCreditorId: "juan-destination",
        paidAt: new Date("2026-04-18T10:20:30.000Z"),
        originExpenseName: "Debt transfer to another party",
        destinationExpenseName: "Debt transfer from another party",
      }),
    ).toThrow("Debt transfer amount must be greater than 0");
  });
});

describe("getDebtTransferParticipantMatch", () => {
  test("preselects a single full-name match", () => {
    expect(
      getDebtTransferParticipantMatch({
        sourceName: "Juan Smith",
        participants: [
          { id: "juan-1", name: "Juan Smith" },
          { id: "juan-2", name: "Juan S." },
        ],
      }),
    ).toEqual({
      exactMatchParticipantId: "juan-1",
      recommendedParticipantIds: [],
    });
  });

  test("returns quick recommendations when the name only partially matches", () => {
    expect(
      getDebtTransferParticipantMatch({
        sourceName: "Juan",
        participants: [
          { id: "juan-smith", name: "Juan Smith" },
          { id: "dani", name: "Dani" },
          { id: "juan-perez", name: "Juan Perez" },
        ],
      }),
    ).toEqual({
      exactMatchParticipantId: null,
      recommendedParticipantIds: ["juan-perez", "juan-smith"],
    });
  });

  test("does not auto-pick when multiple full-name matches exist", () => {
    expect(
      getDebtTransferParticipantMatch({
        sourceName: "Juan",
        participants: [
          { id: "juan-1", name: "Juan" },
          { id: "juan-2", name: "Juan" },
          { id: "dani", name: "Dani" },
        ],
      }),
    ).toEqual({
      exactMatchParticipantId: null,
      recommendedParticipantIds: ["juan-1", "juan-2"],
    });
  });

  test("normalizes accents, punctuation, and spacing when matching", () => {
    expect(
      getDebtTransferParticipantMatch({
        sourceName: "  Juán-Smith ",
        participants: [{ id: "juan-smith", name: "Juan Smith" }],
      }),
    ).toEqual({
      exactMatchParticipantId: "juan-smith",
      recommendedParticipantIds: [],
    });
  });
});
