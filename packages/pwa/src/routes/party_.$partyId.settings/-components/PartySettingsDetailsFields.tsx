import { t } from "@lingui/core/macro";
import { AppEmojiField } from "#src/components/AppEmojiField.tsx";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import {
  validatePartyDescription,
  validatePartySymbol,
  validatePartyTitle,
} from "#src/lib/validation.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { PartyDetailsFormValues } from "./types.js";

export function PartySettingsDetailsFields({ form }: { form: AppFormApi<PartyDetailsFormValues> }) {
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
    </>
  );
}
