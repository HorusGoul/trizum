import { t } from "@lingui/core/macro";
import type { Currency } from "dinero.js";
import { AppEmojiField } from "#src/components/AppEmojiField.tsx";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import {
  validatePartyDescription,
  validatePartySymbol,
  validatePartyTitle,
} from "#src/lib/validation.js";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { CurrencyOption, NewPartyFormValues } from "./types.js";

export function NewPartyDetailsFields({
  currencyOptions,
  form,
}: {
  currencyOptions: CurrencyOption[];
  form: AppFormApi<NewPartyFormValues>;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => validatePartyTitle(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Name`}
              description={t`How do you want to call this party?`}
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
              className="flex-1"
            />
          )}
        </form.Field>

        <form.Field
          name="symbol"
          validators={{
            onChange: ({ value }) => validatePartySymbol(value),
          }}
        >
          {(field) => (
            <AppEmojiField
              label={t`Symbol`}
              visuallyHideLabel
              value={field.state.value}
              onChange={field.handleChange}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
            />
          )}
        </form.Field>
      </div>

      <form.Field
        name="description"
        validators={{
          onChange: ({ value }) => validatePartyDescription(value),
        }}
      >
        {(field) => (
          <AppTextField
            label={t`Description`}
            description={t`What is this party about?`}
            maxLength={500}
            textArea={true}
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            errorMessage={field.state.meta.errors?.join(", ")}
            isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
          />
        )}
      </form.Field>

      <form.Field name="currency">
        {(field) => (
          <AppSelect<CurrencyOption>
            label={t`Currency`}
            description={t`Choose the currency for expenses in this party`}
            items={currencyOptions}
            selectedKey={field.state.value}
            onSelectionChange={(value) => {
              if (value) {
                field.handleChange(value as Currency);
              }
            }}
          >
            {(currency) => (
              <SelectItem
                key={currency.id}
                value={currency}
                textValue={`${currency.symbol} - ${currency.name}`}
              >
                {currency.symbol} - {currency.name}
              </SelectItem>
            )}
          </AppSelect>
        )}
      </form.Field>
    </>
  );
}
