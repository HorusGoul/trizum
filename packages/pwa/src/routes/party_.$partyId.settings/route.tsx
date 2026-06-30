import { t } from "@lingui/core/macro";
import { useParty } from "#src/hooks/useParty.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import {
  DEFAULT_PARTY_SYMBOL,
  normalizePartyExpenseRules,
  type Party,
  type PartyParticipant,
} from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { PartyParticipantsField } from "./-components/PartyParticipantsField.js";
import { PartyExpenseRulesField } from "./-components/PartyExpenseRulesField.js";
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

    updateSettings({
      name: values.name,
      symbol: values.symbol,
      description: values.description,
      expenseRules: values.expenseRules,
      participants,
    });

    toast.success(t`Party settings saved!`);
  }

  const form = useForm({
    defaultValues: {
      name: party.name,
      symbol: party.symbol || DEFAULT_PARTY_SYMBOL,
      description: party.description,
      expenseRules: normalizePartyExpenseRules(party.expenseRules),
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

      <form
        id={formId}
        action={() => {
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <PartySettingsDetailsFields form={form} />
        <form.Field name="expenseRules">
          {(field) => (
            <PartyExpenseRulesField
              currency={party.currency}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
            />
          )}
        </form.Field>
        <PartyParticipantsField
          addNewParticipant={addNewParticipant}
          addParticipantForm={addParticipantForm}
          form={form}
        />
      </form>
    </div>
  );
}
