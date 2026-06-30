import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { ExpenseUser } from "#src/lib/expenses.js";
import type { BalancesByParticipant, Expense } from "./expense";
import type { Currency } from "dinero.js";
import type { MediaFile } from "./media";

export const EXPENSE_RULE_PROPERTIES = ["amount", "title", "receiptCount"] as const;
export const EXPENSE_RULE_OPERATORS = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "contains",
  "doesNotContain",
  "isEmpty",
  "isNotEmpty",
] as const;
export const NUMERIC_EXPENSE_RULE_OPERATORS = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
] as const;
export const TEXT_EXPENSE_RULE_OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "isEmpty",
  "isNotEmpty",
] as const;

export type ExpenseRuleProperty = (typeof EXPENSE_RULE_PROPERTIES)[number];
export type ExpenseRuleOperator = (typeof EXPENSE_RULE_OPERATORS)[number];
export type ExpenseRuleAction = "requireReceipt";
export type ExpenseRuleConditionValue = string | number | boolean | null;

export interface ExpenseRuleCondition {
  id: string;
  property: ExpenseRuleProperty;
  operator: ExpenseRuleOperator;
  value: ExpenseRuleConditionValue;
}

export interface PartyExpenseRule {
  action: ExpenseRuleAction;
  conditions: ExpenseRuleCondition[];
}

export interface PartyExpenseRules {
  rules: PartyExpenseRule[];
}

export const DEFAULT_RECEIPT_REQUIREMENT_AMOUNT = 10_000;

export interface Party {
  id: DocumentId;
  type: "party";
  name: string;
  symbol?: string;
  description: string;
  currency: Currency;
  expenseRules?: PartyExpenseRules;
  participants: Record<ExpenseUser, PartyParticipant>;
  chunkRefs: PartyExpenseChunkRef[];
}

export const DEFAULT_PARTY_SYMBOL = "🏝️";

export type BalancesSortedBy = "name" | "balance-ascending" | "balance-descending";

export interface PartyParticipant {
  id: ExpenseUser;
  name: string;
  phone?: string;
  avatarId?: MediaFile["id"] | null;
  isArchived?: boolean;
  personalMode?: boolean;
  balancesSortedBy?: BalancesSortedBy;
}

export interface PartyExpenseChunkRef {
  chunkId: PartyExpenseChunk["id"];
  createdAt: Date;
  balancesId: PartyExpenseChunkBalances["id"];
}

export interface PartyExpenseChunk {
  id: DocumentId;
  type: "expenseChunk";
  createdAt: Date;
  expenses: Expense[];
  maxSize: number;
  partyId: Party["id"];
}

export interface PartyExpenseChunkBalances {
  id: DocumentId;
  type: "expenseChunkBalances";
  balances: BalancesByParticipant;
  partyId: Party["id"];
}

export function getDefaultPartyExpenseRules(): PartyExpenseRules {
  return {
    rules: [],
  };
}

export function getExpenseRuleOperatorsForProperty(
  property: ExpenseRuleProperty,
): readonly ExpenseRuleOperator[] {
  switch (property) {
    case "amount":
    case "receiptCount":
      return NUMERIC_EXPENSE_RULE_OPERATORS;
    case "title":
      return TEXT_EXPENSE_RULE_OPERATORS;
  }
}

export function getDefaultExpenseRuleOperator(property: ExpenseRuleProperty): ExpenseRuleOperator {
  switch (property) {
    case "amount":
    case "receiptCount":
      return "greaterThan";
    case "title":
      return "contains";
  }
}

export function doesExpenseRuleOperatorNeedValue(operator: ExpenseRuleOperator) {
  return operator !== "isEmpty" && operator !== "isNotEmpty";
}

export function createDefaultExpenseRuleCondition(
  property: ExpenseRuleProperty = "amount",
): ExpenseRuleCondition {
  return {
    id: createExpenseRuleConditionId(),
    property,
    operator: getDefaultExpenseRuleOperator(property),
    value: property === "title" ? "" : DEFAULT_RECEIPT_REQUIREMENT_AMOUNT,
  };
}

export function createDefaultExpenseRule(): PartyExpenseRule {
  return {
    action: "requireReceipt",
    conditions: [],
  };
}

export function normalizePartyExpenseRules(expenseRules?: unknown): PartyExpenseRules {
  const rawExpenseRules = expenseRules as
    | { rules?: unknown; receiptRequirement?: unknown }
    | null
    | undefined;

  if (!rawExpenseRules) {
    return getDefaultPartyExpenseRules();
  }

  const legacyReceiptRequirement = rawExpenseRules.receiptRequirement as
    | { type?: unknown; amount?: unknown }
    | null
    | undefined;

  if (legacyReceiptRequirement) {
    switch (legacyReceiptRequirement.type) {
      case "always":
        return {
          rules: [createDefaultExpenseRule()],
        };
      case "aboveAmount":
        return {
          rules: [
            {
              action: "requireReceipt",
              conditions: [
                normalizeExpenseRuleCondition({
                  property: "amount",
                  operator: "greaterThan",
                  value: legacyReceiptRequirement.amount,
                }),
              ],
            },
          ],
        };
      default:
        return getDefaultPartyExpenseRules();
    }
  }

  if (!Array.isArray(rawExpenseRules.rules)) {
    return getDefaultPartyExpenseRules();
  }

  return {
    rules: rawExpenseRules.rules
      .map(normalizePartyExpenseRule)
      .filter((rule): rule is PartyExpenseRule => Boolean(rule)),
  };
}

function normalizePartyExpenseRule(rawRule: unknown): PartyExpenseRule | null {
  const rule = rawRule as { action?: unknown; conditions?: unknown };

  if (rule.action !== "requireReceipt") {
    return null;
  }

  return {
    action: "requireReceipt",
    conditions: Array.isArray(rule.conditions)
      ? rule.conditions.map((condition, index) => normalizeExpenseRuleCondition(condition, index))
      : [],
  };
}

export function normalizeExpenseRuleCondition(
  rawCondition: unknown,
  fallbackIndex?: number,
): ExpenseRuleCondition {
  const condition = rawCondition as {
    id?: unknown;
    property?: unknown;
    operator?: unknown;
    value?: unknown;
  };
  const property = isExpenseRuleProperty(condition.property) ? condition.property : "amount";
  const allowedOperators = getExpenseRuleOperatorsForProperty(property);
  const defaultOperator = getDefaultExpenseRuleOperator(property);
  const operator = isStringInArray(condition.operator, allowedOperators)
    ? condition.operator
    : defaultOperator;

  return {
    id:
      typeof condition.id === "string" ? condition.id : createExpenseRuleConditionId(fallbackIndex),
    property,
    operator,
    value: normalizeExpenseRuleConditionValue({
      operator,
      property,
      value: condition.value,
    }),
  };
}

function createExpenseRuleConditionId(fallbackIndex?: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `condition-${fallbackIndex ?? Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeExpenseRuleConditionValue({
  operator,
  property,
  value,
}: {
  operator: ExpenseRuleOperator;
  property: ExpenseRuleProperty;
  value: unknown;
}): ExpenseRuleConditionValue {
  if (!doesExpenseRuleOperatorNeedValue(operator)) {
    return null;
  }

  switch (property) {
    case "amount":
    case "receiptCount": {
      const numericValue = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0;
    }
    case "title":
      return typeof value === "string" ? value : "";
  }
}

function isExpenseRuleProperty(value: unknown): value is ExpenseRuleProperty {
  return isStringInArray(value, EXPENSE_RULE_PROPERTIES);
}

function isStringInArray<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export interface ExpenseRuleEvaluationInput {
  amount: number;
  photoCount: number;
  title: string;
}

export interface ExpenseReceiptRuleViolation {
  rule: PartyExpenseRule;
}

export function getExpenseReceiptRuleViolation({
  amount,
  photoCount,
  rules,
  title,
}: {
  amount: number;
  photoCount: number;
  rules?: unknown;
  title: string;
}): ExpenseReceiptRuleViolation | null {
  if (photoCount > 0) {
    return null;
  }

  const matchingRule = normalizePartyExpenseRules(rules).rules.find((rule) => {
    return (
      rule.action === "requireReceipt" &&
      doesExpenseRuleApply(rule, {
        amount,
        photoCount,
        title,
      })
    );
  });

  return matchingRule ? { rule: matchingRule } : null;
}

export function doesExpenseRuleApply(rule: PartyExpenseRule, expense: ExpenseRuleEvaluationInput) {
  return rule.conditions.every((condition) => doesExpenseRuleConditionApply(condition, expense));
}

function doesExpenseRuleConditionApply(
  condition: ExpenseRuleCondition,
  expense: ExpenseRuleEvaluationInput,
) {
  const normalizedCondition = normalizeExpenseRuleCondition(condition);
  const actualValue = getExpenseRulePropertyValue(normalizedCondition.property, expense);
  const conditionValue = normalizedCondition.value;

  switch (normalizedCondition.operator) {
    case "equals":
      return compareConditionValues(actualValue, conditionValue) === 0;
    case "notEquals":
      return compareConditionValues(actualValue, conditionValue) !== 0;
    case "greaterThan":
      return compareConditionValues(actualValue, conditionValue) > 0;
    case "greaterThanOrEqual":
      return compareConditionValues(actualValue, conditionValue) >= 0;
    case "lessThan":
      return compareConditionValues(actualValue, conditionValue) < 0;
    case "lessThanOrEqual":
      return compareConditionValues(actualValue, conditionValue) <= 0;
    case "contains":
      return String(actualValue)
        .toLocaleLowerCase()
        .includes(String(conditionValue).toLocaleLowerCase());
    case "doesNotContain":
      return !String(actualValue)
        .toLocaleLowerCase()
        .includes(String(conditionValue).toLocaleLowerCase());
    case "isEmpty":
      return String(actualValue).trim() === "";
    case "isNotEmpty":
      return String(actualValue).trim() !== "";
  }
}

function getExpenseRulePropertyValue(
  property: ExpenseRuleProperty,
  expense: ExpenseRuleEvaluationInput,
) {
  switch (property) {
    case "amount":
      return expense.amount;
    case "title":
      return expense.title;
    case "receiptCount":
      return expense.photoCount;
  }
}

function compareConditionValues(
  actualValue: ExpenseRuleConditionValue,
  conditionValue: ExpenseRuleConditionValue,
) {
  if (typeof actualValue === "number" || typeof conditionValue === "number") {
    return Number(actualValue) - Number(conditionValue);
  }

  return String(actualValue)
    .toLocaleLowerCase()
    .localeCompare(String(conditionValue).toLocaleLowerCase());
}
