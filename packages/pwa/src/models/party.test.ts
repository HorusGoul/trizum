import { describe, expect, test } from "vite-plus/test";
import {
  createDefaultExpenseRule,
  getDefaultPartyExpenseRules,
  getExpenseReceiptRuleViolation,
  normalizePartyExpenseRules,
} from "./party";

describe("normalizePartyExpenseRules", () => {
  test("defaults missing rules to an empty rule list", () => {
    expect(normalizePartyExpenseRules(undefined)).toStrictEqual(getDefaultPartyExpenseRules());
  });

  test("normalizes generic rule condition values", () => {
    expect(
      normalizePartyExpenseRules({
        rules: [
          {
            action: "requireReceipt",
            conditions: [
              {
                property: "amount",
                operator: "greaterThan",
                value: 5000.6,
              },
            ],
          },
        ],
      }),
    ).toStrictEqual({
      rules: [
        {
          action: "requireReceipt",
          conditions: [
            {
              id: expect.any(String),
              property: "amount",
              operator: "greaterThan",
              value: 5001,
            },
          ],
        },
      ],
    });
  });

  test("converts legacy above-amount receipt rules into generic amount conditions", () => {
    expect(
      normalizePartyExpenseRules({
        receiptRequirement: {
          type: "aboveAmount",
          amount: 10_000,
        },
      }),
    ).toStrictEqual({
      rules: [
        {
          action: "requireReceipt",
          conditions: [
            {
              id: expect.any(String),
              property: "amount",
              operator: "greaterThan",
              value: 10_000,
            },
          ],
        },
      ],
    });
  });
});

describe("getExpenseReceiptRuleViolation", () => {
  test("does not require receipts when rules are missing", () => {
    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_000,
        photoCount: 0,
        title: "Lunch",
      }),
    ).toBeNull();
  });

  test("requires a receipt when a receipt rule has no conditions", () => {
    const rule = createDefaultExpenseRule();

    expect(
      getExpenseReceiptRuleViolation({
        amount: 1,
        photoCount: 0,
        title: "Lunch",
        rules: {
          rules: [rule],
        },
      }),
    ).toStrictEqual({
      rule,
    });
  });

  test("does not report a violation when a receipt is present", () => {
    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_000,
        photoCount: 1,
        title: "Lunch",
        rules: {
          rules: [createDefaultExpenseRule()],
        },
      }),
    ).toBeNull();
  });

  test("requires a receipt only when amount condition matches", () => {
    const rules = {
      rules: [
        {
          action: "requireReceipt",
          conditions: [
            {
              id: "amount-condition",
              property: "amount",
              operator: "greaterThan",
              value: 10_000,
            },
          ],
        },
      ],
    } as const;

    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_000,
        photoCount: 0,
        title: "Lunch",
        rules,
      }),
    ).toBeNull();

    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_001,
        photoCount: 0,
        title: "Lunch",
        rules,
      }),
    ).toStrictEqual({
      rule: rules.rules[0],
    });
  });

  test("supports text conditions on the expense title", () => {
    const rules = {
      rules: [
        {
          action: "requireReceipt",
          conditions: [
            {
              id: "title-condition",
              property: "title",
              operator: "contains",
              value: "hotel",
            },
          ],
        },
      ],
    } as const;

    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_000,
        photoCount: 0,
        title: "Lunch",
        rules,
      }),
    ).toBeNull();

    expect(
      getExpenseReceiptRuleViolation({
        amount: 10_000,
        photoCount: 0,
        title: "Hotel deposit",
        rules,
      }),
    ).toStrictEqual({
      rule: rules.rules[0],
    });
  });
});
