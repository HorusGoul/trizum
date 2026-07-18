import { describe, expect, test } from "vite-plus/test";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "./party.ts";
import type { ExpenseTemplate } from "./expenseTemplate.ts";
import {
  getExpenseTemplateEditorValues,
  resolveExpenseTemplateValues,
  shouldOpenExpenseTemplatePicker,
} from "./expenseTemplate.ts";

function createParty(template?: ExpenseTemplate): Party {
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
