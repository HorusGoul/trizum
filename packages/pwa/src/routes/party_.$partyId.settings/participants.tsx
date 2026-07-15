import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { useParty } from "#src/hooks/useParty.js";
import { IconButton } from "#src/ui/IconButton.js";
import { NewPartyParticipantInput } from "./-components/NewPartyParticipantInput.js";
import { PartyParticipantsField } from "./-components/PartyParticipantsField.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";
import { toPartyParticipantRecord } from "./-components/toPartyParticipantRecord.js";
import type {
  AddPartyParticipantFormValues,
  PartyParticipantsFormValues,
} from "./-components/types.js";

export const Route = createFileRoute("/party_/$partyId/settings/participants")({
  component: PartyParticipantSettings,
});

function PartyParticipantSettings() {
  const { partyId } = Route.useParams();
  const { party, updateParticipants } = useParty(partyId);
  const navigate = useNavigate();
  const formId = useId();

  const form = useForm({
    defaultValues: {
      participants: Object.values(party.participants),
    } as PartyParticipantsFormValues,
    onSubmit: ({ value }) => {
      const participants = toPartyParticipantRecord(value.participants);

      updateParticipants(participants);
      form.reset({ participants: Object.values(participants) });
      toast.success(t`Participants saved!`);
      void navigate({
        to: "/party/$partyId/settings",
        params: { partyId },
        replace: true,
      });
    },
  });

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
        title={<Trans>Participants</Trans>}
        fallbackOptions={{
          to: "/party/$partyId/settings",
          params: { partyId },
        }}
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

      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col px-4"
      >
        <PartyParticipantsField form={form}>
          <NewPartyParticipantInput
            addNewParticipant={addNewParticipant}
            addParticipantForm={addParticipantForm}
          />
        </PartyParticipantsField>
      </form>
    </div>
  );
}
