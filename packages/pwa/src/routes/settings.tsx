import { BackButton } from "#src/components/BackButton.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import {
  validatePartyParticipantName,
  validatePhoneNumber,
} from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

interface SettingsFormValues {
  username: string;
  phone: string;
}

function Settings() {
  const { partyList, updateSettings } = usePartyList();

  async function onSaveSettings(values: SettingsFormValues) {
    updateSettings(values);
    form.reset();
    toast.success(t`Settings saved`);
  }

  const form = useForm<SettingsFormValues>({
    defaultValues: {
      username: partyList.username ?? "",
      phone: partyList.phone ?? "",
    },
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />

        <h1 className="pl-4 text-2xl font-bold">
          <Trans>Settings</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isDirty,
          ]}
        >
          {([canSubmit, isSubmitting, isDirty]) =>
            canSubmit && isDirty ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="check"
                  aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                  type="submit"
                  form={formId}
                  isDisabled={isSubmitting}
                />
              </Suspense>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) => validatePartyParticipantName(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Username`}
              description={t`What's your preferred way to be addressed?`}
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>

        <form.Field
          name="phone"
          validators={{
            onChange: ({ value }) => validatePhoneNumber(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Phone number`}
              description={t`For payments through Bizum or similar services`}
              maxLength={20}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>
      </form>
    </div>
  );
}
