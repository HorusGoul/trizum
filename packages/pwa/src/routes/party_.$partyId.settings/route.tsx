import { t } from "@lingui/core/macro";
import { useParty } from "#src/hooks/useParty.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { DEFAULT_PARTY_SYMBOL, type Party, type PartyParticipant } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { PartyParticipantsField } from "./-components/PartyParticipantsField.js";
import { PartySettingsDetailsFields } from "./-components/PartySettingsDetailsFields.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";
import type {
  AddPartyParticipantFormValues,
  PartySettingsFormValues,
} from "./-components/types.js";

export const Route = createFileRoute("/party_/$partyId/settings")({
  component: PartySettings,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params, location }) => {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function PartySettings() {
  const params = Route.useParams();
  const { party, updateSettings } = useParty(params.partyId);
  const navigate = useNavigate();

  function onSaveSettings(values: PartySettingsFormValues) {
    const participants = values.participants
      .map((participant): PartyParticipant => {
        if ("__isNew" in participant) {
          return {
            id: participant.id,
            name: participant.name,
          };
        }

        return { ...participant };
      })
      .reduce<Party["participants"]>((result, next) => {
        result[next.id] = next;
        return result;
      }, {});
    const savedValues = {
      name: values.name,
      symbol: values.symbol,
      description: values.description,
      participants: Object.values(participants),
    } as PartySettingsFormValues;

    updateSettings({
      name: savedValues.name,
      symbol: savedValues.symbol,
      description: savedValues.description,
      participants,
    });

    form.reset(savedValues);
    toast.success(t`Party settings saved!`);
    void navigate({ to: "..", replace: true });
  }

  const form = useForm({
    defaultValues: {
      name: party.name,
      symbol: party.symbol || DEFAULT_PARTY_SYMBOL,
      description: party.description,
      participants: Object.values(party.participants),
    } as PartySettingsFormValues,
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  const addParticipantForm = useForm({
    defaultValues: {
      newParticipantName: "",
    } satisfies AddPartyParticipantFormValues,
  });

  function addNewParticipant() {
    void addParticipantForm.validateField("newParticipantName", "submit");

    const meta = addParticipantForm.getFieldMeta("newParticipantName");
    const errorCount = meta?.errors?.length ?? 0;

    if (errorCount) {
      return;
    }

    const newParticipantName = addParticipantForm.getFieldValue("newParticipantName");

    form.pushFieldValue("participants", {
      id: crypto.randomUUID(),
      name: newParticipantName,
      __isNew: true,
    });

    addParticipantForm.setFieldValue("newParticipantName", "");
  }

  return (
    <div className="flex min-h-full flex-col">
      <PartySettingsHeader
        submitButton={
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
          >
            {([canSubmit, isSubmitting, isDirty]) =>
              canSubmit && isDirty ? (
                <Suspense fallback={null}>
                  <IconButton
                    icon="lucide.check"
                    aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                    type="submit"
                    form={formId}
                    isDisabled={isSubmitting}
                  />
                </Suspense>
              ) : null
            }
          </form.Subscribe>
        }
      />

      {/* eslint-disable-next-line react-doctor/no-prevent-default -- React form actions reset TanStack Form to stale defaults after saving settings. */}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <PartySettingsDetailsFields form={form} />
        <PartyParticipantsField
          addNewParticipant={addNewParticipant}
          addParticipantForm={addParticipantForm}
          form={form}
        />
      </form>
    </div>
  );
}
