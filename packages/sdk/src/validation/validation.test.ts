import { describe, test, expect } from "vitest";
import {
  validatePartyTitle,
  validatePartyDescription,
  validateParticipantName,
  validatePhoneNumber,
  validateExpenseTitle,
  validateExpenseAmount,
  validateExpensePaidBy,
  validateExpenseShares,
  validateDocumentId,
  composeValidators,
  required,
  maxLength,
  PARTY_TITLE_REQUIRED,
  PARTY_TITLE_TOO_LONG,
  PARTY_DESCRIPTION_TOO_LONG,
  PARTICIPANT_NAME_REQUIRED,
  PARTICIPANT_NAME_TOO_LONG,
  PHONE_NUMBER_TOO_LONG,
  EXPENSE_TITLE_REQUIRED,
  EXPENSE_TITLE_TOO_LONG,
  EXPENSE_AMOUNT_REQUIRED,
  EXPENSE_AMOUNT_INVALID,
  EXPENSE_PAID_BY_NOT_INTEGER,
  EXPENSE_SHARE_VALUE_NOT_INTEGER,
  DOCUMENT_ID_REQUIRED,
  DOCUMENT_ID_INVALID,
  MAX_PARTY_TITLE_LENGTH,
  MAX_PARTY_DESCRIPTION_LENGTH,
  MAX_PARTICIPANT_NAME_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
} from "./index.js";

describe("validatePartyTitle", () => {
  test("should return null for valid title", () => {
    expect(validatePartyTitle("My Party")).toBeNull();
    expect(validatePartyTitle("Trip to Paris")).toBeNull();
  });

  test("should return error for empty title", () => {
    expect(validatePartyTitle("")).toBe(PARTY_TITLE_REQUIRED);
    expect(validatePartyTitle("   ")).toBe(PARTY_TITLE_REQUIRED);
  });

  test("should return error for title too long", () => {
    const longTitle = "a".repeat(MAX_PARTY_TITLE_LENGTH + 1);
    expect(validatePartyTitle(longTitle)).toBe(PARTY_TITLE_TOO_LONG);
  });

  test("should accept title at max length", () => {
    const maxTitle = "a".repeat(MAX_PARTY_TITLE_LENGTH);
    expect(validatePartyTitle(maxTitle)).toBeNull();
  });
});

describe("validatePartyDescription", () => {
  test("should return null for valid description", () => {
    expect(validatePartyDescription("A fun trip")).toBeNull();
    expect(validatePartyDescription("")).toBeNull(); // Empty is valid
  });

  test("should return error for description too long", () => {
    const longDesc = "a".repeat(MAX_PARTY_DESCRIPTION_LENGTH + 1);
    expect(validatePartyDescription(longDesc)).toBe(PARTY_DESCRIPTION_TOO_LONG);
  });
});

describe("validateParticipantName", () => {
  test("should return null for valid name", () => {
    expect(validateParticipantName("John")).toBeNull();
    expect(validateParticipantName("Mary Jane")).toBeNull();
  });

  test("should return error for empty name", () => {
    expect(validateParticipantName("")).toBe(PARTICIPANT_NAME_REQUIRED);
    expect(validateParticipantName("  ")).toBe(PARTICIPANT_NAME_REQUIRED);
  });

  test("should return error for name too long", () => {
    const longName = "a".repeat(MAX_PARTICIPANT_NAME_LENGTH + 1);
    expect(validateParticipantName(longName)).toBe(PARTICIPANT_NAME_TOO_LONG);
  });
});

describe("validatePhoneNumber", () => {
  test("should return null for valid phone", () => {
    expect(validatePhoneNumber("+1234567890")).toBeNull();
    expect(validatePhoneNumber("")).toBeNull(); // Empty is valid
  });

  test("should return error for phone too long", () => {
    const longPhone = "1".repeat(MAX_PHONE_NUMBER_LENGTH + 1);
    expect(validatePhoneNumber(longPhone)).toBe(PHONE_NUMBER_TOO_LONG);
  });
});

describe("validateExpenseTitle", () => {
  test("should return null for valid title", () => {
    expect(validateExpenseTitle("Dinner")).toBeNull();
    expect(validateExpenseTitle("Groceries at Store")).toBeNull();
  });

  test("should return error for empty title", () => {
    expect(validateExpenseTitle("")).toBe(EXPENSE_TITLE_REQUIRED);
  });

  test("should return error for title too long", () => {
    const longTitle = "a".repeat(MAX_PARTY_TITLE_LENGTH + 1);
    expect(validateExpenseTitle(longTitle)).toBe(EXPENSE_TITLE_TOO_LONG);
  });
});

describe("validateExpenseAmount", () => {
  test("should return null for valid amount", () => {
    expect(validateExpenseAmount(10.5)).toBeNull();
    expect(validateExpenseAmount(0.01)).toBeNull();
    expect(validateExpenseAmount("25.00")).toBeNull();
  });

  test("should return error for zero amount", () => {
    expect(validateExpenseAmount(0)).toBe(EXPENSE_AMOUNT_REQUIRED);
    expect(validateExpenseAmount("0")).toBe(EXPENSE_AMOUNT_REQUIRED);
  });

  test("should return error for negative amount", () => {
    expect(validateExpenseAmount(-10)).toBe(EXPENSE_AMOUNT_INVALID);
  });

  test("should return error for invalid string", () => {
    expect(validateExpenseAmount("abc")).toBe(EXPENSE_AMOUNT_REQUIRED);
    expect(validateExpenseAmount("")).toBe(EXPENSE_AMOUNT_REQUIRED);
  });
});

describe("validateExpensePaidBy", () => {
  test("should return null for integer amounts", () => {
    expect(validateExpensePaidBy({ user1: 1000 })).toBeNull();
    expect(validateExpensePaidBy({ user1: 500, user2: 500 })).toBeNull();
    expect(validateExpensePaidBy({ user1: 0 })).toBeNull();
    expect(validateExpensePaidBy({ user1: -100 })).toBeNull(); // Negative integers are allowed
  });

  test("should return error for float amounts", () => {
    expect(validateExpensePaidBy({ user1: 10.5 })).toBe(
      EXPENSE_PAID_BY_NOT_INTEGER,
    );
    expect(validateExpensePaidBy({ user1: 1000, user2: 10.5 })).toBe(
      EXPENSE_PAID_BY_NOT_INTEGER,
    );
    expect(validateExpensePaidBy({ user1: 0.01 })).toBe(
      EXPENSE_PAID_BY_NOT_INTEGER,
    );
  });

  test("should return null for empty paidBy", () => {
    expect(validateExpensePaidBy({})).toBeNull();
  });
});

describe("validateExpenseShares", () => {
  test("should return null for integer share values", () => {
    expect(
      validateExpenseShares({
        user1: { type: "divide", value: 1 },
        user2: { type: "divide", value: 2 },
      }),
    ).toBeNull();

    expect(
      validateExpenseShares({
        user1: { type: "exact", value: 500 },
        user2: { type: "exact", value: 500 },
      }),
    ).toBeNull();

    expect(
      validateExpenseShares({
        user1: { type: "exact", value: 500 },
        user2: { type: "divide", value: 1 },
      }),
    ).toBeNull();
  });

  test("should return error for float divide values", () => {
    expect(
      validateExpenseShares({
        user1: { type: "divide", value: 1.5 },
        user2: { type: "divide", value: 2 },
      }),
    ).toBe(EXPENSE_SHARE_VALUE_NOT_INTEGER);
  });

  test("should return error for float exact values", () => {
    expect(
      validateExpenseShares({
        user1: { type: "exact", value: 10.5 },
        user2: { type: "exact", value: 500 },
      }),
    ).toBe(EXPENSE_SHARE_VALUE_NOT_INTEGER);
  });

  test("should return null for empty shares", () => {
    expect(validateExpenseShares({})).toBeNull();
  });
});

describe("validateDocumentId", () => {
  test("should return error for empty ID", () => {
    expect(validateDocumentId("")).toBe(DOCUMENT_ID_REQUIRED);
    expect(validateDocumentId("   ")).toBe(DOCUMENT_ID_REQUIRED);
  });

  test("should return error for invalid ID format", () => {
    // All these are invalid - Automerge doc IDs have a specific format
    expect(validateDocumentId("invalid")).toBe(DOCUMENT_ID_INVALID);
    expect(validateDocumentId("not-a-valid-id")).toBe(DOCUMENT_ID_INVALID);
    expect(validateDocumentId("automerge:abc123")).toBe(DOCUMENT_ID_INVALID);
  });
});

describe("composeValidators", () => {
  test("should return null when all validators pass", () => {
    const validator = composeValidators(
      required("REQUIRED"),
      maxLength(10, "TOO_LONG"),
    );

    expect(validator("hello")).toBeNull();
  });

  test("should return first error when validation fails", () => {
    const validator = composeValidators(
      required("REQUIRED"),
      maxLength(3, "TOO_LONG"),
    );

    expect(validator("")).toBe("REQUIRED");
    expect(validator("hello")).toBe("TOO_LONG");
  });
});
