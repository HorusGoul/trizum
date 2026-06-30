import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { convertToUnits } from "#src/lib/expenses.ts";
import {
  createDefaultExpenseRule,
  createDefaultExpenseRuleCondition,
  doesExpenseRuleOperatorNeedValue,
  getExpenseRuleOperatorsForProperty,
  normalizeExpenseRuleCondition,
  normalizePartyExpenseRules,
  type ExpenseRuleCondition,
  type ExpenseRuleOperator,
  type ExpenseRuleProperty,
  type Party,
  type PartyExpenseRule,
  type PartyExpenseRules,
} from "#src/models/party.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { AppCurrencyField, AppNumberField, AppTextField } from "#src/ui/fields/TextField.js";

interface PartyExpenseRulesFieldProps {
  currency: Party["currency"];
  errorMessage?: string;
  isInvalid?: boolean;
  onBlur: () => void;
  onChange: (value: PartyExpenseRules) => void;
  value: PartyExpenseRules;
}

type MessageOption<T extends string> = {
  id: T;
  label: MessageDescriptor;
};

const EXPENSE_PROPERTY_OPTIONS = [
  {
    id: "amount",
    label: msg`Amount`,
  },
  {
    id: "title",
    label: msg`Title`,
  },
  {
    id: "receiptCount",
    label: msg`Receipt count`,
  },
] satisfies MessageOption<ExpenseRuleProperty>[];

const EXPENSE_OPERATOR_LABELS = {
  equals: msg`is equal to`,
  notEquals: msg`is not equal to`,
  greaterThan: msg`is greater than`,
  greaterThanOrEqual: msg`is greater than or equal to`,
  lessThan: msg`is less than`,
  lessThanOrEqual: msg`is less than or equal to`,
  contains: msg`contains`,
  doesNotContain: msg`does not contain`,
  isEmpty: msg`is empty`,
  isNotEmpty: msg`is not empty`,
} satisfies Record<ExpenseRuleOperator, MessageDescriptor>;

export function PartyExpenseRulesField({
  currency,
  errorMessage,
  isInvalid,
  onBlur,
  onChange,
  value,
}: PartyExpenseRulesFieldProps) {
  const { _ } = useLingui();
  const expenseRules = normalizePartyExpenseRules(value);
  const receiptRuleIndex = expenseRules.rules.findIndex((rule) => rule.action === "requireReceipt");
  const receiptRule = receiptRuleIndex >= 0 ? expenseRules.rules[receiptRuleIndex] : null;

  function setRules(rules: PartyExpenseRule[]) {
    onChange(normalizePartyExpenseRules({ rules }));
  }

  function setReceiptRule(nextRule: PartyExpenseRule | null) {
    const nextRules = expenseRules.rules.slice();

    if (receiptRuleIndex >= 0) {
      if (nextRule) {
        nextRules[receiptRuleIndex] = nextRule;
      } else {
        nextRules.splice(receiptRuleIndex, 1);
      }
    } else if (nextRule) {
      nextRules.push(nextRule);
    }

    setRules(nextRules);
  }

  function updateCondition(index: number, condition: ExpenseRuleCondition) {
    if (!receiptRule) {
      return;
    }

    const conditions = receiptRule.conditions.slice();
    conditions[index] = normalizeExpenseRuleCondition(condition);

    setReceiptRule({
      ...receiptRule,
      conditions,
    });
  }

  function removeCondition(index: number) {
    if (!receiptRule) {
      return;
    }

    setReceiptRule({
      ...receiptRule,
      conditions: receiptRule.conditions.filter((_, conditionIndex) => conditionIndex !== index),
    });
  }

  return (
    <section>
      <h2 className="text-lg font-medium">
        <Trans>Expense rules</Trans>
      </h2>

      <p className="mt-2">
        <Trans>
          Build rules from expense fields, conditions, and values. Matching expenses can still be
          saved with an acknowledged override.
        </Trans>
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {receiptRule ? (
          <div className="rounded-lg border border-accent-500 bg-white p-4 dark:border-accent-700 dark:bg-accent-900">
            <div className="flex items-start gap-3">
              <Icon icon="lucide.receipt-text" className="mt-0.5 size-5 flex-shrink-0" />

              <div className="min-w-0 flex-1">
                <h3 className="font-medium">
                  <Trans>Require receipt</Trans>
                </h3>

                <p className="mt-1 text-sm text-accent-700 dark:text-accent-50">
                  <Trans>When all conditions match, the expense should include a receipt.</Trans>
                </p>
              </div>

              <IconButton
                icon="lucide.trash-2"
                aria-label={t`Remove receipt rule`}
                color="transparent"
                className="h-8 w-8 flex-shrink-0"
                iconClassName="size-4"
                onPress={() => setReceiptRule(null)}
              />
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium">
                <Trans>When</Trans>
              </h4>

              {receiptRule.conditions.length === 0 ? (
                <p className="mt-2 text-sm text-accent-700 dark:text-accent-50">
                  <Trans>No conditions. This rule applies to every expense.</Trans>
                </p>
              ) : null}

              <div className="mt-3 flex flex-col gap-3">
                {receiptRule.conditions.map((condition, index) => (
                  <ExpenseRuleConditionRow
                    key={condition.id}
                    condition={condition}
                    currency={currency}
                    onBlur={onBlur}
                    onChange={(nextCondition) => updateCondition(index, nextCondition)}
                    onRemove={() => removeCondition(index)}
                  />
                ))}
              </div>

              <Button
                color="input-like"
                className="mt-4 w-auto px-4"
                onPress={() => {
                  setReceiptRule({
                    ...receiptRule,
                    conditions: [...receiptRule.conditions, createDefaultExpenseRuleCondition()],
                  });
                }}
              >
                <Icon icon="lucide.plus" className="mr-2 size-4" />
                <Trans>Add condition</Trans>
              </Button>
            </div>
          </div>
        ) : (
          <Button
            color="input-like"
            className="h-auto min-h-16 justify-start rounded-lg px-4 py-4"
            onPress={() => setReceiptRule(createDefaultExpenseRule())}
          >
            <Icon icon="lucide.plus" className="mr-3 size-5" />
            <span className="flex flex-col items-start text-left">
              <span className="font-medium">
                <Trans>Add receipt rule</Trans>
              </span>
              <span className="mt-1 text-sm text-accent-700 dark:text-accent-50">
                <Trans>Require receipts when expense conditions match.</Trans>
              </span>
            </span>
          </Button>
        )}

        {isInvalid && errorMessage ? (
          <p className="text-sm font-medium text-danger-500">{errorMessage}</p>
        ) : null}
      </div>
    </section>
  );
}

function ExpenseRuleConditionRow({
  condition,
  currency,
  onBlur,
  onChange,
  onRemove,
}: {
  condition: ExpenseRuleCondition;
  currency: Party["currency"];
  onBlur: () => void;
  onChange: (condition: ExpenseRuleCondition) => void;
  onRemove: () => void;
}) {
  const { _ } = useLingui();
  const operatorOptions = getExpenseRuleOperatorsForProperty(condition.property).map(
    (operator) => ({
      id: operator,
      label: EXPENSE_OPERATOR_LABELS[operator],
    }),
  );

  function updateProperty(property: ExpenseRuleProperty) {
    onChange({
      ...createDefaultExpenseRuleCondition(property),
      id: condition.id,
    });
  }

  function updateOperator(operator: ExpenseRuleOperator) {
    const defaultCondition = createDefaultExpenseRuleCondition(condition.property);
    onChange(
      normalizeExpenseRuleCondition({
        ...condition,
        operator,
        value: doesExpenseRuleOperatorNeedValue(operator)
          ? (condition.value ?? defaultCondition.value)
          : null,
      }),
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
      <AppSelect<MessageOption<ExpenseRuleProperty>>
        aria-label={t`Expense property`}
        items={EXPENSE_PROPERTY_OPTIONS}
        selectedKey={condition.property}
        onBlur={onBlur}
        onSelectionChange={(key) => {
          if (key) {
            updateProperty(String(key) as ExpenseRuleProperty);
          }
        }}
      >
        {(option) => (
          <SelectItem key={option.id} value={option} textValue={_(option.label)}>
            {_(option.label)}
          </SelectItem>
        )}
      </AppSelect>

      <AppSelect<MessageOption<ExpenseRuleOperator>>
        aria-label={t`Condition`}
        items={operatorOptions}
        selectedKey={condition.operator}
        onBlur={onBlur}
        onSelectionChange={(key) => {
          if (key) {
            updateOperator(String(key) as ExpenseRuleOperator);
          }
        }}
      >
        {(option) => (
          <SelectItem key={option.id} value={option} textValue={_(option.label)}>
            {_(option.label)}
          </SelectItem>
        )}
      </AppSelect>

      <ConditionValueField
        condition={condition}
        currency={currency}
        onBlur={onBlur}
        onChange={onChange}
      />

      <IconButton
        icon="lucide.x"
        aria-label={t`Remove condition`}
        color="input-like"
        className="h-10 w-10"
        iconClassName="size-4"
        onPress={onRemove}
      />
    </div>
  );
}

function ConditionValueField({
  condition,
  currency,
  onBlur,
  onChange,
}: {
  condition: ExpenseRuleCondition;
  currency: Party["currency"];
  onBlur: () => void;
  onChange: (condition: ExpenseRuleCondition) => void;
}) {
  if (!doesExpenseRuleOperatorNeedValue(condition.operator)) {
    return <div className="hidden md:block" />;
  }

  switch (condition.property) {
    case "amount":
      return (
        <AppCurrencyField
          aria-label={t`Value`}
          value={Number(condition.value) / 100}
          onBlur={onBlur}
          onChange={(amount) => {
            onChange({
              ...condition,
              value: Math.max(0, convertToUnits(amount)),
            });
          }}
          currency={currency}
          className="col-span-2 md:col-span-1"
        />
      );
    case "receiptCount":
      return (
        <AppNumberField
          aria-label={t`Value`}
          value={Number(condition.value)}
          minValue={0}
          step={1}
          inputMode="numeric"
          onBlur={onBlur}
          onChange={(count) => {
            onChange({
              ...condition,
              value: Math.max(0, Math.round(count)),
            });
          }}
          className="col-span-2 md:col-span-1"
        />
      );
    case "title":
      return (
        <AppTextField
          aria-label={t`Value`}
          value={String(condition.value)}
          onBlur={onBlur}
          onChange={(text) => {
            onChange({
              ...condition,
              value: text,
            });
          }}
          className="col-span-2 md:col-span-1"
        />
      );
  }
}
