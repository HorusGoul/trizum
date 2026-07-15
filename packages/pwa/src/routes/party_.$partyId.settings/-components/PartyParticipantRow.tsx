import { t } from "@lingui/core/macro";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { validatePartyParticipantName } from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { PartyParticipantsFormValues } from "./types.js";

export function PartyParticipantRow({
  form,
  index,
  isArchived = false,
  onArchiveToggle,
  onRemove,
  participant,
}: {
  form: AppFormApi<PartyParticipantsFormValues>;
  index: number;
  isArchived?: boolean;
  onArchiveToggle: () => void;
  onRemove?: () => void;
  participant: PartyParticipantsFormValues["participants"][number];
}) {
  return (
    <div className="flex w-full gap-2">
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
            isDisabled={isArchived}
          />
        )}
      </form.Field>

      {"__isNew" in participant && !isArchived ? (
        <IconButton
          icon="lucide.trash"
          aria-label={t`Remove`}
          onPress={onRemove}
          className="shrink-0"
        />
      ) : (
        <IconButton
          icon={isArchived ? "lucide.archive-restore" : "lucide.archive"}
          aria-label={isArchived ? t`Restore` : t`Archive`}
          onPress={onArchiveToggle}
          className="shrink-0"
        />
      )}
    </div>
  );
}
