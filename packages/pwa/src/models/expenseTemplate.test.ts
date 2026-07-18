import { describe, expect, test } from "vite-plus/test";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "./party.ts";
import type { ExpenseTemplate } from "./expenseTemplate.ts";
import { resolveExpenseTemplateValues } from "./expenseTemplate.ts";

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
});
