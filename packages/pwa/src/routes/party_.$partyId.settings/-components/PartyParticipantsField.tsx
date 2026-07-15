import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PartyParticipant } from "#src/models/party.js";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { PartyParticipantRow } from "./PartyParticipantRow.js";
import { toggleParticipantArchived } from "./toggleParticipantArchived.js";
import type { PartyParticipantsFormValues } from "./types.js";
import type { ReactNode } from "react";

export function PartyParticipantsField({
  children,
  form,
}: {
  children: ReactNode;
  form: AppFormApi<PartyParticipantsFormValues>;
}) {
  return (
    <div>
      <p>
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
                <span className="text-danger-500 text-sm font-medium">
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

              {children}

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

      <div className="h-16 shrink-0" />
    </div>
  );
}
