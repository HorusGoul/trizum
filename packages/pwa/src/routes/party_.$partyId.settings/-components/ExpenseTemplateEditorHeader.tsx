import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Suspense } from "react";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import type { ExpenseTemplateEditorValues } from "#src/models/expenseTemplate.ts";
import { IconButton } from "#src/ui/IconButton.tsx";
import { PartySettingsHeader } from "./PartySettingsHeader.tsx";

export function ExpenseTemplateEditorHeader({
  form,
  formId,
  isNew,
  partyId,
}: {
  form: AppFormApi<ExpenseTemplateEditorValues>;
  formId: string;
  isNew: boolean;
  partyId: string;
}) {
  return (
    <PartySettingsHeader
      title={isNew ? <Trans>New template</Trans> : <Trans>Edit template</Trans>}
      fallbackOptions={{
        to: "/party/$partyId/settings/expense-templates",
        params: { partyId },
      }}
      submitButton={
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}>
          {([canSubmit, isSubmitting, isDirty]) =>
            canSubmit && (isNew || isDirty) ? (
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
  );
}
