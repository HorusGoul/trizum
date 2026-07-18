import { convertFromUnits, type ExpenseUser } from "#src/lib/expenses.ts";
import type { Expense } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";

export const MAX_EXPENSE_TEMPLATES = 4;
export const DEFAULT_EXPENSE_TEMPLATE_SYMBOL = "🧾";

export type ExpenseTemplatePayer =
  | { type: "current-participant" }
  | { type: "participant"; participantId: ExpenseUser };

export interface ExpenseTemplate {
  id: string;
  name: string;
  symbol: string;
  expenseName?: string;
  /** The total amount in integer minor units. */
  amount?: number;
  paidBy: ExpenseTemplatePayer;
  participantSelection: "all" | "specific";
  shares: Expense["shares"];
}

export interface ExpenseTemplateEditorValues {
  name: string;
  symbol: string;
  expenseName: string;
  amount: number;
  paidBy: string;
  participantSelection: "all" | "specific";
  shares: Expense["shares"];
}

export interface ResolvedExpenseTemplateValues {
  name: string;
  amount: number;
  paidAt: Date;
  paidBy: ExpenseUser;
  shares: Expense["shares"];
  photos: [];
}

export function getExpenseTemplateEditorValues(
  template?: ExpenseTemplate,
): ExpenseTemplateEditorValues {
  return {
    name: template?.name ?? "",
    symbol: template?.symbol ?? DEFAULT_EXPENSE_TEMPLATE_SYMBOL,
    expenseName: template?.expenseName ?? "",
    amount: template?.amount === undefined ? 0 : convertFromUnits(template.amount),
    paidBy:
      template?.paidBy.type === "participant"
        ? template.paidBy.participantId
        : "current-participant",
    participantSelection: template?.participantSelection ?? "specific",
    shares: template?.shares ?? {},
  };
}

export function resolveExpenseTemplateValues({
  currentParticipantId,
  now,
  party,
  templateId,
}: {
  currentParticipantId: ExpenseUser;
  now: Date;
  party: Party;
  templateId?: string;
}): ResolvedExpenseTemplateValues {
  const template = templateId ? party.expenseTemplates?.[templateId] : undefined;

  if (!template) {
    return {
      name: "",
      amount: 0,
      paidBy: currentParticipantId,
      shares: {},
      paidAt: now,
      photos: [],
    };
  }

  const activeParticipantIds = Object.values(party.participants).reduce<ExpenseUser[]>(
    (result, participant) => {
      if (!participant.isArchived) {
        result.push(participant.id);
      }
      return result;
    },
    [],
  );
  const activeParticipantIdSet = new Set(activeParticipantIds);

  const shares =
    template.participantSelection === "all"
      ? activeParticipantIds.reduce<Expense["shares"]>((result, participantId) => {
          result[participantId] = template.shares[participantId] ?? {
            type: "divide",
            value: 1,
          };
          return result;
        }, {})
      : Object.fromEntries(
          Object.entries(template.shares).filter(([participantId]) =>
            activeParticipantIdSet.has(participantId),
          ),
        );

  const configuredPayerId =
    template.paidBy.type === "participant" ? template.paidBy.participantId : undefined;
  const paidBy =
    configuredPayerId && activeParticipantIdSet.has(configuredPayerId)
      ? configuredPayerId
      : currentParticipantId;

  return {
    name: template.expenseName ?? "",
    amount: template.amount === undefined ? 0 : convertFromUnits(template.amount),
    paidBy,
    shares,
    paidAt: now,
    photos: [],
  };
}
