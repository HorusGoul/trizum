import { use } from "react";
import { useStore } from "@tanstack/react-form";
import { useLingui } from "@lingui/react/macro";
import { AppSelect, SelectItem } from "@trizum/ui/Select";
import { AppNumberField } from "@trizum/ui/fields/TextField";
import type { ExpenseEditorFormValues } from "./ExpenseEditor";
import type { AppFormApi } from "../lib/reactFormTypes";
import { CurrencyContext } from "./CurrencyContext";
import { CurrencyField } from "./CurrencyField";
import type { CurrencyFieldProps } from "./CurrencyField";
import { isCurrencyCode } from "../lib/money";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { getExchangeRate } from "../lib/exchangeRates";
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
  const { t, i18n } = useLingui();
  const partyCurrency = use(CurrencyContext);
  const table = useExchangeRates(partyCurrency);
  const original = useStore(form.store, (state) => state.values.originalAmount);
  const exchangeRate = useStore(form.store, (state) => state.values.exchangeRate);
  const currency = original?.currency ?? partyCurrency;
  const currencyNames = new Intl.DisplayNames([i18n.locale], { type: "currency" });

  const currencies = Array.from(
    new Set([partyCurrency, currency, ...Intl.supportedValuesOf("currency")]),
  )
    .filter(isCurrencyCode)
    .map((id) => ({ id, name: `${id} · ${currencyNames.of(id) ?? id}` }));

  const convertedAmountLabel = t({ message: `Converted amount (${partyCurrency})` });
  const rateDescription = t({ message: `${partyCurrency} per 1 ${currency}` });

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
                label={t`Exchange rate`}
                description={rateDescription}
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
      <AppSelect
        label={t`Currency`}
        items={currencies}
        selectedKey={currency}
        className="min-w-0"
        onSelectionChange={(selection) => {
          const key = String(selection);

          if (!isCurrencyCode(key) || key === currency) return;
          calculatorProps.onCloseCalculator?.();

          if (key === partyCurrency) {
            form.setFieldValue("originalAmount", null);
            form.setFieldValue("exchangeRate", null);
          } else {
            const rate = getExchangeRate(table, key)?.rate ?? null;
            updateConversion(
              {
                currency: key,
                amount: original?.amount ?? convertToUnits(form.state.values.amount),
              },
              rate,
            );
          }
        }}
      >
        {(item) => (
          <SelectItem key={item.id} value={item} textValue={item.name}>
            {item.name}
          </SelectItem>
        )}
      </AppSelect>
    </>
  );
}
