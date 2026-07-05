import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { focusInputIntoView } from "#src/lib/focusInputIntoView.ts";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { validatePartyParticipantName } from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { AddParticipantFormValues, NewPartyFormValues } from "./types.js";

export function NewPartyParticipantsField({
  addNewParticipant,
  addParticipantForm,
  form,
}: {
  addNewParticipant: () => void;
  addParticipantForm: AppFormApi<AddParticipantFormValues>;
  form: AppFormApi<NewPartyFormValues>;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium">
        <Trans>Participants</Trans>
      </h2>

      <p className="mt-2">
        <Trans>Who is invited to this party? You can add more participants later.</Trans>
      </p>

      <form.Field
        name="participants"
        mode="array"
        validators={{
          onChange: ({ value }) => {
            if (value.length === 0) {
              return t`At least one participant is required`;
            }
          },
        }}
      >
        {(field) => (
          <div className="mt-4 flex flex-col gap-4">
            {field.state.meta.errors?.length > 0 ? (
              <span className="text-danger-500 text-sm font-medium">
                {field.state.meta.errors.join(", ")}
              </span>
            ) : null}

            {field.state.value.map((participant, index) => (
              <div key={participant.id} className="flex w-full gap-2">
                <form.Field
                  name={`participants[${index}].name`}
                  validators={{
                    onChange: ({ value }) => validatePartyParticipantName(value),
                  }}
                >
                  {(field) => (
                    <AppTextField
                      name={field.name}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      aria-label={t`Participant name`}
                      className="w-full"
                      errorMessage={field.state.meta.errors?.join(", ")}
                      isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
                    />
                  )}
                </form.Field>

                <IconButton
                  icon="lucide.trash"
                  aria-label={t`Remove`}
                  onPress={() => field.removeValue(index)}
                  className="shrink-0"
                />
              </div>
            ))}

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
                className="shrink-0"
                color="accent"
                onPress={addNewParticipant}
              />
            </div>
          </div>
        )}
      </form.Field>

      <div className="h-16 shrink-0" />
    </div>
  );
}
