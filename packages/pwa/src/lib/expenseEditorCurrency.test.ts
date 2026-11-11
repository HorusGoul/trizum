import { expect, test } from "vite-plus/test";
import {
  getExpenseEditorCurrencyAmount,
  getExpenseEditorDraftValues,
  getExpenseEditorStoredValues,
} from "./expenseEditorCurrency";
import { expenseEditorSharesMatchAmount, getExpenseEditorUnitShares } from "./expenseEditor";
import { migrationExpenseShareSchema } from "./api/migrationContract";

const draft = {
  amount: 90,
  originalAmount: { amount: 12000, currency: "USD" as const },
  exchangeRate: 0.75,
  shares: {
    alex: { type: "exact" as const, value: 3000 },
    blair: { type: "divide" as const, value: 2 },
    casey: { type: "divide" as const, value: 1 },
  },
};

test("uses the original total for exact and weighted participant fields", () => {
  expect(getExpenseEditorUnitShares(getExpenseEditorCurrencyAmount(draft), draft.shares)).toEqual({
    alex: 3000,
    blair: 6000,
    casey: 3000,
  });
  const stored = getExpenseEditorStoredValues(draft);
  expect(stored.shares).toEqual({
    alex: { type: "exact", value: 2250, originalAmount: 3000 },
    blair: { type: "divide", value: 2, originalAmount: 6000 },
    casey: { type: "divide", value: 1, originalAmount: 3000 },
  });
  expect(stored.shares.alex.value).toBe(2250);
  expect(getExpenseEditorUnitShares(stored.amount, stored.shares)).toEqual({
    alex: 2250,
    blair: 4500,
    casey: 2250,
  });
  expect(getExpenseEditorDraftValues(stored)).toEqual(draft);
});

test("keeps the foreign exact amount stable across rate edits and currency relabelling", () => {
  expect(
    getExpenseEditorStoredValues({ ...draft, amount: 60, exchangeRate: 0.5 }).shares.alex.value,
  ).toBe(1500);
  const local = { ...draft, amount: 120, originalAmount: null, exchangeRate: null };
  expect(getExpenseEditorStoredValues(local)).toEqual(local);
  expect(getExpenseEditorCurrencyAmount(local)).toBe(120);
  expect(draft.shares.alex.value).toBe(3000);
});

test("keeps draft shares when there is no rate yet", () => {
  const missingRate = { ...draft, amount: 0, exchangeRate: null };
  expect(getExpenseEditorDraftValues(getExpenseEditorStoredValues(missingRate))).toEqual(
    missingRate,
  );
  expect(getExpenseEditorCurrencyAmount(missingRate)).toBe(120);
});

test("converts balanced exact shares together so rounding preserves the converted total", () => {
  const values = {
    amount: 0.02,
    originalAmount: { amount: 3, currency: "USD" as const },
    exchangeRate: 0.5,
    shares: {
      alex: { type: "exact" as const, value: 1 },
      blair: { type: "exact" as const, value: 1 },
      casey: { type: "exact" as const, value: 1 },
    },
  };

  const stored = getExpenseEditorStoredValues(values);
  expect(getExpenseEditorDraftValues(stored)).toEqual(values);
  expect(expenseEditorSharesMatchAmount(stored.amount, stored.shares)).toBe(true);
  expect(expenseEditorSharesMatchAmount(0.03, getExpenseEditorDraftValues(stored).shares)).toBe(
    true,
  );
  expect(Object.values(stored.shares).every((share) => share.type === "exact")).toBe(true);
});

test("clears original share metadata when the expense returns to party currency", () => {
  const stored = getExpenseEditorStoredValues(draft);

  const local = getExpenseEditorStoredValues({
    ...stored,
    originalAmount: null,
    exchangeRate: null,
  });

  expect(Object.values(local.shares).every((share) => !("originalAmount" in share))).toBe(true);
});

test("legacy foreign shares fall back to the saved rate", () => {
  const legacy = {
    ...draft,
    shares: {
      alex: { type: "exact" as const, value: 2250 },
      blair: { type: "divide" as const, value: 1 },
    },
  };

  expect(getExpenseEditorDraftValues(legacy).shares.alex.value).toBe(3000);
});

test("migration validation preserves optional original share amounts", () => {
  for (const share of Object.values(getExpenseEditorStoredValues(draft).shares)) {
    expect(migrationExpenseShareSchema.parse(share)).toEqual(share);
  }

  expect(
    migrationExpenseShareSchema.safeParse({ type: "exact", value: 100, originalAmount: -1 })
      .success,
  ).toBe(false);
  expect(migrationExpenseShareSchema.parse({ type: "divide", value: 1 })).toEqual({
    type: "divide",
    value: 1,
  });
});

test("leaves an unbalanced exact split unbalanced rather than hiding validation errors", () => {
  const values = {
    ...draft,
    shares: { alex: { type: "exact" as const, value: 1000 } },
  };

  const stored = getExpenseEditorStoredValues(values);
  expect(stored.shares.alex.value).toBe(750);
  expect(expenseEditorSharesMatchAmount(stored.amount, stored.shares)).toBe(false);
});

test("rounds mixed splits without exact shares exceeding the converted total", () => {
  const values = {
    amount: 0.02,
    originalAmount: { amount: 4, currency: "USD" as const },
    exchangeRate: 0.6,
    shares: {
      alex: { type: "exact" as const, value: 1 },
      blair: { type: "exact" as const, value: 1 },
      casey: { type: "exact" as const, value: 1 },
      devon: { type: "divide" as const, value: 1 },
    },
  };

  const stored = getExpenseEditorStoredValues(values);
  expect(expenseEditorSharesMatchAmount(stored.amount, stored.shares)).toBe(true);
  expect(getExpenseEditorDraftValues(stored)).toEqual(values);
});

test("preserves authoritative legacy allocations until monetary inputs change", () => {
  const saved = {
    name: "Legacy import",
    amount: 150,
    originalAmount: { amount: 100, currency: "USD" as const },
    exchangeRate: 150,
    shares: {
      alex: { type: "exact" as const, value: 5000 },
      blair: { type: "divide" as const, value: 1 },
    },
  };

  const values = getExpenseEditorDraftValues(saved);
  expect(values.shares.alex.value).toBe(33);
  expect(getExpenseEditorStoredValues({ ...values, name: "Renamed" }, saved).shares).toEqual(
    saved.shares,
  );
  expect(
    getExpenseEditorStoredValues({ ...values, amount: 100, exchangeRate: 100 }, saved).shares.alex
      .value,
  ).toBe(3300);
  expect(
    getExpenseEditorStoredValues(
      { ...values, shares: { ...values.shares, alex: { type: "exact", value: 50 } } },
      saved,
    ).shares.alex.value,
  ).toBe(7500);
});

test("keeps zero allocations out of conversion remainders in both directions", () => {
  const values = {
    amount: 96.01,
    originalAmount: { amount: 12000, currency: "USD" as const },
    exchangeRate: 0.8001,
    shares: {
      alex: { type: "exact" as const, value: 0 },
      blair: { type: "exact" as const, value: 6000 },
      casey: { type: "exact" as const, value: 6000 },
    },
  };

  const stored = getExpenseEditorStoredValues(values);
  expect(stored.shares.alex).toEqual({ type: "exact", value: 0, originalAmount: 0 });
  expect(expenseEditorSharesMatchAmount(stored.amount, stored.shares)).toBe(true);

  const legacy = {
    ...stored,
    shares: Object.fromEntries(
      Object.entries(stored.shares).map(([id, share]) => [
        id,
        { type: share.type, value: share.value },
      ]),
    ),
  };

  expect(getExpenseEditorDraftValues(legacy).shares.alex.value).toBe(0);
});
