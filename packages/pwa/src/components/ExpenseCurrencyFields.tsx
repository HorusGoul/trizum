import { use } from "react";
import { useStore } from "@tanstack/react-form";
import { useLingui } from "@lingui/react/macro";
import { AppNumberField } from "@trizum/ui/fields/TextField";
import type { ExpenseEditorFormValues } from "./ExpenseEditor";
import type { AppFormApi } from "../lib/reactFormTypes";
import { CurrencyContext } from "./CurrencyContext";
import { CurrencyField } from "./CurrencyField";
import type { CurrencyFieldProps } from "./CurrencyField";
import { CurrencySelect } from "./CurrencySelect";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { setExpenseEditorCurrency } from "../lib/expenseEditorCurrency";
import { getExchangeRate } from "../lib/exchangeRateTables";
import { convertExpenseAmount } from "../lib/currencyConversion";
import { convertToUnits } from "../lib/expenses";

interface ExpenseCurrencyFieldsProps extends Pick<
  CurrencyFieldProps,
  "activeCalculatorId" | "autoOpenCalculator" | "onCloseCalculator" | "onOpenCalculator"
> {
  form: AppFormApi<ExpenseEditorFormValues>;
  photos: ExpenseEditorFormValues["photos"];
  createFieldFocusHandlers: (field: { name: string; handleBlur: () => void }) => {
    onFocus: () => void;
    onBlur: () => void;
  };
}

export function ExpenseCurrencyFields({
  form,
  photos,
  createFieldFocusHandlers,
  ...calculatorProps
}: ExpenseCurrencyFieldsProps) {
  const { t } = useLingui();
  const partyCurrency = use(CurrencyContext);
  const table = useExchangeRates(partyCurrency);
  const original = useStore(form.store, (state) => state.values.originalAmount);
  const exchangeRate = useStore(form.store, (state) => state.values.exchangeRate);
  const currency = original?.currency ?? partyCurrency;

  const convertedAmountLabel = t({ message: `Converted amount (${partyCurrency})` });
  const exchangeRateLabel = t({ message: `Exchange rate (${partyCurrency}/${currency})` });

  function updateConversion(nextOriginal: NonNullable<typeof original>, rate: number | null) {
    form.setFieldValue("originalAmount", nextOriginal);
    form.setFieldValue("exchangeRate", rate);
    form.setFieldValue("amount", (convertExpenseAmount(nextOriginal.amount, rate ?? 0) ?? 0) / 100);
  }

  return (
    <>
      <CurrencyContext value={currency}>
        {original ? (
          <form.Field name="originalAmount">
            {(field) => (
              <CurrencyField
                {...calculatorProps}
                calculator
                calculatorId="originalAmount"
                calculatorAttachmentPhotoIds={photos}
                label={t({ message: `Original amount (${currency})` })}
                name={field.name}
                value={(field.state.value?.amount ?? 0) / 100}
                minValue={0}
                onChange={(value) =>
                  updateConversion(
                    { currency, amount: convertToUnits(value || 0) },
                    exchangeRate ?? null,
                  )
                }
                className="min-w-0"
                data-presence-element-id="originalAmount"
                {...createFieldFocusHandlers(field)}
              />
            )}
          </form.Field>
        ) : (
          <form.Field
            name="amount"
            validators={{
              onChange: ({ value }) => (value <= 0 ? t`Amount must be greater than 0` : undefined),
            }}
          >
            {(field) => (
              <CurrencyField
                {...calculatorProps}
                calculator
                calculatorId="amount"
                calculatorAttachmentPhotoIds={photos}
                label={t`Amount`}
                name={field.name}
                value={field.state.value}
                minValue={0}
                onChange={(value) => field.handleChange(value || 0)}
                errorMessage={field.state.meta.errors?.join(", ")}
                isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
                className="min-w-0"
                data-presence-element-id="amount"
                data-presence-offset-top={6}
                data-presence-offset-left={-10}
                {...createFieldFocusHandlers(field)}
                onFocus={(event) => {
                  event.currentTarget.select();
                  createFieldFocusHandlers(field).onFocus();
                }}
              />
            )}
          </form.Field>
        )}
      </CurrencyContext>
      {original && (
        <>
          <form.Field name="amount">
            {(field) => (
              <CurrencyField
                label={convertedAmountLabel}
                name={field.name}
                value={field.state.value}
                isReadOnly
                minValue={0}
                className="min-w-0"
                inputClassName="cursor-default border-dashed border-accent-300 bg-accent-100/50 font-semibold text-accent-600 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200"
              />
            )}
          </form.Field>
          <form.Field name="exchangeRate">
            {(field) => (
              <AppNumberField
                label={exchangeRateLabel}
                name={field.name}
                value={field.state.value ?? Number.NaN}
                onChange={(value) =>
                  updateConversion(original, Number.isFinite(value) ? value : null)
                }
                minValue={0}
                formatOptions={{ maximumSignificantDigits: 17, useGrouping: false }}
                isInvalid={field.state.value != null && field.state.value <= 0}
                errorMessage={t`Exchange rate must be greater than 0`}
                className="min-w-0"
                data-presence-element-id="exchangeRate"
                {...createFieldFocusHandlers(field)}
              />
            )}
          </form.Field>
        </>
      )}
      <CurrencySelect
        currency={currency}
        partyCurrency={partyCurrency}
        className="min-w-0"
        onChange={(key) => {
          calculatorProps.onCloseCalculator?.();
          setExpenseEditorCurrency(
            form,
            partyCurrency,
            key,
            getExchangeRate(table, key)?.rate ?? null,
          );
        }}
      />
    </>
  );
}
