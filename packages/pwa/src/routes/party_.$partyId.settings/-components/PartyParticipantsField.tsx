import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PartyParticipant } from "#src/models/party.js";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { NewPartyParticipantInput } from "./NewPartyParticipantInput.js";
import { PartyParticipantRow } from "./PartyParticipantRow.js";
import { toggleParticipantArchived } from "./toggleParticipantArchived.js";
import type { AddPartyParticipantFormValues, PartySettingsFormValues } from "./types.js";

export function PartyParticipantsField({
  addNewParticipant,
  addParticipantForm,
  form,
}: {
  addNewParticipant: () => void;
  addParticipantForm: AppFormApi<AddPartyParticipantFormValues>;
  form: AppFormApi<PartySettingsFormValues>;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium">
        <Trans>Participants</Trans>
      </h2>

      <p className="mt-2">
        <Trans>Manage the participants list. Existing members can only be archived.</Trans>
      </p>

      <form.Field
        name="participants"
        mode="array"
        validators={{
          onChange: ({ value }) => {
            const hasActiveParticipant = value.some((participant) => {
              if ("__isNew" in participant) {
                return true;
              }

              return !participant.isArchived;
            });

            if (!hasActiveParticipant) {
              return t`At least one participant is required`;
            }
          },
        }}
      >
        {(field) => {
          const activeParticipants = [];
          const archivedParticipants = [];

          for (const participant of field.state.value) {
            if ("__isNew" in participant || !participant.isArchived) {
              activeParticipants.push(participant);
            } else {
              archivedParticipants.push(participant);
            }
          }

          function indexOf(participant: PartyParticipant) {
            return field.state.value.indexOf(participant);
          }

          return (
            <div className="mt-4 flex flex-col gap-4">
              {field.state.meta.errors?.length > 0 ? (
                <span className="text-sm font-medium text-danger-500">
                  {field.state.meta.errors.join(", ")}
                </span>
              ) : null}

              {activeParticipants.map((participant) => (
                <PartyParticipantRow
                  key={participant.id}
                  form={form}
                  index={indexOf(participant)}
                  participant={participant}
                  onArchiveToggle={() => {
                    field.setValue((values) => toggleParticipantArchived(values, participant));
                  }}
                  onRemove={() => field.removeValue(indexOf(participant))}
                />
              ))}

              <NewPartyParticipantInput
                addNewParticipant={addNewParticipant}
                addParticipantForm={addParticipantForm}
              />

              {archivedParticipants.length ? (
                <h3 className="font-medium">
                  <Trans>Archived participants</Trans>
                </h3>
              ) : null}

              {archivedParticipants.map((participant) => (
                <PartyParticipantRow
                  key={participant.id}
                  form={form}
                  index={indexOf(participant)}
                  isArchived
                  participant={participant}
                  onArchiveToggle={() => {
                    field.setValue((values) => toggleParticipantArchived(values, participant));
                  }}
                />
              ))}
            </div>
          );
        }}
      </form.Field>

      <div className="h-16 flex-shrink-0" />
    </div>
  );
}
