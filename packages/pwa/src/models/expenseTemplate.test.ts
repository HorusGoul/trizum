import { describe, expect, test } from "vite-plus/test";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "./party.ts";
import type { ExpenseTemplate } from "./expenseTemplate.ts";
import {
  getExpenseTemplateEditorValues,
  getExpenseTemplateFromEditorValues,
  resolveExpenseTemplateValues,
  shouldOpenExpenseTemplatePicker,
} from "./expenseTemplate.ts";
import type { ExchangeRates } from "#src/lib/api/exchangeRatesContract.ts";

const referenceRates: ExchangeRates = {
  base: "EUR",
  rates: { EUR: { rate: 1, date: "2099-01-01" }, USD: { rate: 2, date: "2099-01-01" } },
};

function createForeignTemplate(): ExpenseTemplate {
  return {
    id: "abroad",
    name: "Abroad",
    symbol: "🧾",
    amount: 10000,
    currency: "USD",
    exchangeRateMode: "fixed",
    exchangeRate: 0.75,
    paidBy: { type: "current-participant" },
    participantSelection: "all",
    shares: { alex: { type: "exact", value: 3000 }, blair: { type: "divide", value: 1 } },
  };
}

test("fixed foreign templates preserve their rate and original shares", () => {
  const template = createForeignTemplate();

  const values = resolveExpenseTemplateValues({
    currentParticipantId: "alex",
    now: new Date(),
    party: createParty(template),
    templateId: template.id,
    exchangeRates: referenceRates,
  });

  expect(values).toMatchObject({
    amount: 75,
    exchangeRate: 0.75,
    originalAmount: { amount: 10000, currency: "USD" },
    shares: {
      alex: { type: "exact", value: 2250, originalAmount: 3000 },
      blair: { type: "divide", value: 1, originalAmount: 7000 },
    },
  });
});

test("latest foreign templates resolve each expense from the supplied reference table", () => {
  const template = { ...createForeignTemplate(), exchangeRateMode: "latest" as const };

  const options = {
    currentParticipantId: "alex",
    now: new Date(),
    party: createParty(template),
    templateId: template.id,
  };

  expect(resolveExpenseTemplateValues({ ...options, exchangeRates: referenceRates })).toMatchObject(
    { amount: 50, exchangeRate: 0.5 },
  );

  const updated: ExchangeRates = {
    ...referenceRates,
    rates: { ...referenceRates.rates, USD: { rate: 4, date: "2099-01-02" } },
  };

  expect(resolveExpenseTemplateValues({ ...options, exchangeRates: updated })).toMatchObject({
    amount: 25,
    exchangeRate: 0.25,
  });
  expect(template.amount).toBe(10000);
});

test("currency-only templates still preselect the foreign currency", () => {
  const template = createForeignTemplate();
  delete template.amount;

  const values = resolveExpenseTemplateValues({
    currentParticipantId: "alex",
    now: new Date(),
    party: createParty(template),
    templateId: template.id,
  });

  expect(values).toMatchObject({
    amount: 0,
    originalAmount: { amount: 0, currency: "USD" },
    exchangeRate: 0.75,
  });
});

test("switching rate policies and returning to party currency clears obsolete defaults", () => {
  const values = getExpenseTemplateEditorValues(createForeignTemplate());

  const latest = getExpenseTemplateFromEditorValues("abroad", {
    ...values,
    exchangeRateMode: "latest",
  });

  expect(latest.exchangeRateMode).toBe("latest");
  expect(latest.exchangeRate).toBeUndefined();
  const local = getExpenseTemplateFromEditorValues("abroad", { ...values, currency: null });
  expect(local.currency).toBeUndefined();
  expect(local.exchangeRateMode).toBeUndefined();
  expect(local.exchangeRate).toBeUndefined();
  expect(local.amount).toBe(10000);
});

function createParty(template?: ExpenseTemplate): Party {
  // SAFETY: Synthetic document IDs only key the in-memory fixture; this test never decodes them or opens a network document.
  return {
    id: "party" as DocumentId,
    type: "party",
    name: "Trip",
    description: "",
    currency: "EUR",
    participants: {
      alex: { id: "alex", name: "Alex" },
      blair: { id: "blair", name: "Blair" },
      casey: { id: "casey", name: "Casey", isArchived: true },
    },
    chunkRefs: [],
    expenseTemplates: template ? { [template.id]: template } : {},
  };
}

describe("resolveExpenseTemplateValues", () => {
  test("keeps the existing blank expense defaults without a template", () => {
    const now = new Date("2026-07-18T12:00:00Z");

    expect(
      resolveExpenseTemplateValues({
        currentParticipantId: "alex",
        now,
        party: createParty(),
      }),
    ).toEqual({
      name: "",
      amount: 0,
      paidBy: "alex",
      shares: {},
      paidAt: now,
      photos: [],
    });
  });

  test("resolves all active participants and gives new participants one part", () => {
    const template: ExpenseTemplate = {
      id: "dinner",
      name: "Dinner",
      symbol: "🍝",
      expenseName: "Friday dinner",
      amount: 4250,
      paidBy: { type: "participant", participantId: "blair" },
      participantSelection: "all",
      shares: {
        alex: { type: "divide", value: 2 },
        casey: { type: "divide", value: 3 },
      },
    };

    expect(
      resolveExpenseTemplateValues({
        currentParticipantId: "alex",
        now: new Date("2026-07-18T12:00:00Z"),
        party: createParty(template),
        templateId: template.id,
      }),
    ).toMatchObject({
      name: "Friday dinner",
      amount: 42.5,
      paidBy: "blair",
      shares: {
        alex: { type: "divide", value: 2 },
        blair: { type: "divide", value: 1 },
      },
    });
  });

  test("omits archived specific participants and falls back from an unavailable payer", () => {
    const template: ExpenseTemplate = {
      id: "lunch",
      name: "Lunch",
      symbol: "🥪",
      paidBy: { type: "participant", participantId: "casey" },
      participantSelection: "specific",
      shares: {
        alex: { type: "exact", value: 500 },
        casey: { type: "exact", value: 500 },
      },
    };

    expect(
      resolveExpenseTemplateValues({
        currentParticipantId: "blair",
        now: new Date("2026-07-18T12:00:00Z"),
        party: createParty(template),
        templateId: template.id,
      }),
    ).toMatchObject({
      paidBy: "blair",
      shares: { alex: { type: "exact", value: 500 } },
    });
  });

  test("does not include future participants when every current participant was selected explicitly", () => {
    const template: ExpenseTemplate = {
      id: "roommates",
      name: "Roommates",
      symbol: "🏠",
      paidBy: { type: "current-participant" },
      participantSelection: "specific",
      shares: {
        alex: { type: "divide", value: 1 },
        blair: { type: "divide", value: 1 },
      },
    };

    const party = createParty(template);
    party.participants.devon = { id: "devon", name: "Devon" };

    expect(
      resolveExpenseTemplateValues({
        currentParticipantId: "alex",
        now: new Date("2026-07-18T12:00:00Z"),
        party,
        templateId: template.id,
      }).shares,
    ).toEqual({
      alex: { type: "divide", value: 1 },
      blair: { type: "divide", value: 1 },
    });
  });
});

describe("getExpenseTemplateEditorValues", () => {
  test("shows every active participant selected for an all-participants template", () => {
    const template: ExpenseTemplate = {
      id: "dinner",
      name: "Dinner",
      symbol: "🍝",
      paidBy: { type: "current-participant" },
      participantSelection: "all",
      shares: {
        alex: { type: "divide", value: 2 },
      },
    };

    const editorValues = getExpenseTemplateEditorValues(template, ["alex", "blair"]);

    expect(editorValues.shares).toEqual({
      alex: { type: "divide", value: 2 },
      blair: { type: "divide", value: 1 },
    });
    expect(template.shares).toEqual({
      alex: { type: "divide", value: 2 },
    });
    expect(editorValues.shares.alex).not.toBe(template.shares.alex);
  });
});

describe("shouldOpenExpenseTemplatePicker", () => {
  test("skips the picker when blank expense is the only option", () => {
    expect(
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: false,
        customTemplateCount: 0,
      }),
    ).toBe(false);
  });

  test("opens the picker when custom templates provide a choice", () => {
    expect(
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: false,
        customTemplateCount: 1,
      }),
    ).toBe(true);
  });

  test("skips the picker when one custom template is the only available option", () => {
    expect(
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: false,
        customTemplateCount: 1,
        onlyUseCustomTemplates: true,
      }),
    ).toBe(false);
  });

  test("opens the picker when custom-only mode still provides a choice", () => {
    expect(
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: false,
        customTemplateCount: 2,
        onlyUseCustomTemplates: true,
      }),
    ).toBe(true);
  });

  test("skips the picker when the personal default preference is enabled", () => {
    expect(
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: true,
        customTemplateCount: 1,
      }),
    ).toBe(false);
  });
});
