import { convertFromUnits, convertToUnits, type ExpenseUser } from "#src/lib/expenses.ts";
import type { CurrencyCode } from "#src/lib/money.ts";
import type { ExchangeRates } from "#src/lib/api/exchangeRatesContract.ts";
import { getExchangeRate, getBundledExchangeRates } from "#src/lib/exchangeRateTables.ts";
import { convertExpenseAmount, type ExpenseConversionValues } from "#src/lib/currencyConversion.ts";
import { getExpenseEditorStoredValues } from "#src/lib/expenseEditorCurrency.ts";
import type { Expense } from "#src/models/expense.ts";
import type { Party } from "#src/models/party.ts";

export const MAX_EXPENSE_TEMPLATES = 4;
export const BLANK_EXPENSE_TEMPLATE_SYMBOL = "📄";
export const DEFAULT_EXPENSE_TEMPLATE_SYMBOL = "🧾";

export class ExpenseTemplateLimitError extends Error {
  constructor() {
    super("Expense template limit reached");
    this.name = "ExpenseTemplateLimitError";
  }
}

export type ExpenseTemplatePayer =
  | { type: "current-participant" }
  | { type: "participant"; participantId: ExpenseUser };

export interface ExpenseTemplate {
  id: string;
  name: string;
  symbol: string;
  expenseName?: string;
  /** The total in hundredths of currency, or the party currency when omitted. */
  amount?: number;
  currency?: CurrencyCode;
  exchangeRateMode?: "latest" | "fixed";
  /** Used only in fixed mode, in party-currency units per selected-currency unit. */
  exchangeRate?: number;
  paidBy: ExpenseTemplatePayer;
  participantSelection: "all" | "specific";
  /** Exact share values use the template's currency. Divide values remain weights. */
  shares: Expense["shares"];
}

export interface ExpenseTemplateEditorValues {
  name: string;
  symbol: string;
  expenseName: string;
  amount: number;
  currency: CurrencyCode | null;
  exchangeRateMode: "latest" | "fixed";
  exchangeRate: number | null;
  paidBy: string;
  participantSelection: "all" | "specific";
  shares: Expense["shares"];
}

export interface ResolvedExpenseTemplateValues extends ExpenseConversionValues {
  name: string;
  amount: number;
  paidAt: Date;
  paidBy: ExpenseUser;
  shares: Expense["shares"];
  photos: [];
}

function copyExpenseShares(shares: Expense["shares"]): Expense["shares"] {
  return Object.fromEntries(
    Object.entries(shares).map(([participantId, share]) => [participantId, { ...share }]),
  );
}

export function copyExpenseTemplate(template: ExpenseTemplate): ExpenseTemplate {
  const paidBy: ExpenseTemplatePayer =
    template.paidBy.type === "participant"
      ? { type: "participant", participantId: template.paidBy.participantId }
      : { type: "current-participant" };

  return {
    ...template,
    paidBy,
    shares: copyExpenseShares(template.shares),
  };
}

export function shouldOpenExpenseTemplatePicker({
  alwaysUseDefaultTemplate,
  customTemplateCount,
  onlyUseCustomTemplates = false,
}: {
  alwaysUseDefaultTemplate: boolean;
  customTemplateCount: number;
  onlyUseCustomTemplates?: boolean;
}) {
  const availableTemplateCount = customTemplateCount + (onlyUseCustomTemplates ? 0 : 1);

  return !alwaysUseDefaultTemplate && availableTemplateCount > 1;
}

export function getFirstExpenseTemplateId(
  templates: Record<ExpenseTemplate["id"], ExpenseTemplate> | undefined,
) {
  return Object.values(templates ?? {}).sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  )[0]?.id;
}

export function getExpenseTemplateEditorValues(
  template?: ExpenseTemplate,
  activeParticipantIds: ExpenseUser[] = [],
  defaultName = "",
): ExpenseTemplateEditorValues {
  const shares = copyExpenseShares(template?.shares ?? {});

  if (template?.participantSelection === "all") {
    for (const participantId of activeParticipantIds) {
      shares[participantId] ??= { type: "divide", value: 1 };
    }
  }

  return {
    name: template?.name ?? defaultName,
    symbol: template?.symbol ?? DEFAULT_EXPENSE_TEMPLATE_SYMBOL,
    expenseName: template?.expenseName ?? "",
    amount: template?.amount === undefined ? 0 : convertFromUnits(template.amount),
    currency: template?.currency ?? null,
    exchangeRateMode: template?.exchangeRateMode ?? "latest",
    exchangeRate: template?.exchangeRate ?? null,
    paidBy:
      template?.paidBy.type === "participant"
        ? template.paidBy.participantId
        : "current-participant",
    participantSelection: template?.participantSelection ?? "specific",
    shares,
  };
}

export function getExpenseTemplateFromEditorValues(
  id: string,
  values: ExpenseTemplateEditorValues,
): ExpenseTemplate {
  const template: ExpenseTemplate = {
    id,
    name: values.name.trim(),
    symbol: values.symbol,
    paidBy:
      values.paidBy === "current-participant"
        ? { type: "current-participant" }
        : { type: "participant", participantId: values.paidBy },
    participantSelection: values.participantSelection,
    shares: copyExpenseShares(values.shares),
  };

  if (values.expenseName.trim()) template.expenseName = values.expenseName.trim();

  if (values.amount > 0) template.amount = convertToUnits(values.amount);

  if (values.currency) {
    template.currency = values.currency;
    template.exchangeRateMode = values.exchangeRateMode;

    if (values.exchangeRateMode === "fixed" && values.exchangeRate != null)
      template.exchangeRate = values.exchangeRate;
  }

  return template;
}

export function resolveExpenseTemplateValues({
  currentParticipantId,
  now,
  party,
  templateId,
  exchangeRates,
}: {
  currentParticipantId: ExpenseUser;
  now: Date;
  party: Party;
  templateId?: string;
  exchangeRates?: ExchangeRates;
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

  const values: ResolvedExpenseTemplateValues = {
    name: template.expenseName ?? "",
    amount: template.amount === undefined ? 0 : convertFromUnits(template.amount),
    paidBy,
    shares: copyExpenseShares(shares),
    paidAt: now,
    photos: [],
  };

  if (!template.currency || template.currency === party.currency) return values;

  const rate =
    template.exchangeRateMode === "fixed"
      ? template.exchangeRate
      : getExchangeRate(exchangeRates ?? getBundledExchangeRates(party.currency), template.currency)
          ?.rate;

  const originalAmount = { amount: template.amount ?? 0, currency: template.currency };

  return getExpenseEditorStoredValues({
    ...values,
    amount: (convertExpenseAmount(originalAmount.amount, rate ?? 0) ?? 0) / 100,
    originalAmount,
    exchangeRate: rate ?? null,
  });
}
