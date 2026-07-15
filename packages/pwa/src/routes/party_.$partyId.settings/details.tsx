import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { useBackNavigation } from "#src/hooks/useBackNavigation.js";
import { useParty } from "#src/hooks/useParty.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import { PartySettingsDetailsFields } from "./-components/PartySettingsDetailsFields.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";
import type { PartyDetailsFormValues } from "./-components/types.js";

export const Route = createFileRoute("/party_/$partyId/settings/details")({
  component: PartyDetailsSettings,
});

function PartyDetailsSettings() {
  const { partyId } = Route.useParams();
  const { party, updateDetails } = useParty(partyId);
  const returnToSettings = useBackNavigation({
    to: "/party/$partyId/settings",
    params: { partyId },
  });
  const formId = useId();

  const form = useForm({
    defaultValues: {
      name: party.name,
      symbol: party.symbol || DEFAULT_PARTY_SYMBOL,
      description: party.description,
    } satisfies PartyDetailsFormValues,
    onSubmit: ({ value }) => {
      updateDetails(value);
      form.reset(value);
      toast.success(t`Party details saved!`);
      returnToSettings();
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <PartySettingsHeader
        title={<Trans>Party details</Trans>}
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
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <PartySettingsDetailsFields form={form} />
      </form>
    </div>
  );
}
