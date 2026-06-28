import { t } from "@lingui/core/macro";
import { focusInputIntoView } from "#src/lib/focusInputIntoView.ts";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { validatePartyParticipantName } from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { AddPartyParticipantFormValues } from "./types.js";

export function NewPartyParticipantInput({
  addNewParticipant,
  addParticipantForm,
}: {
  addNewParticipant: () => void;
  addParticipantForm: AppFormApi<AddPartyParticipantFormValues>;
}) {
  return (
    <div className="flex w-full gap-2">
      <addParticipantForm.Field
        name="newParticipantName"
        validators={{
          onSubmit: ({ value }) => validatePartyParticipantName(value),
        }}
      >
        {(field) => (
          <AppTextField
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            aria-label={t`New participant name`}
            className="w-full"
            errorMessage={field.state.meta.errors?.join(", ")}
            isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const input = e.currentTarget;
                addNewParticipant();
                window.requestAnimationFrame(() => focusInputIntoView(input));
              }
            }}
          />
        )}
      </addParticipantForm.Field>

      <IconButton
        icon="lucide.plus"
        aria-label={t`Add participant`}
        className="flex-shrink-0"
        color="accent"
        onPress={addNewParticipant}
      />
    </div>
  );
}
