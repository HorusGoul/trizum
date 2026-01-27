import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { AvatarPicker } from "#src/components/AvatarPicker.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import {
  validatePartyParticipantName,
  validatePhoneNumber,
} from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import type { MediaFile } from "#src/models/media.ts";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/i18n.js";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { SwitchField } from "#src/components/SwitchField.tsx";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

interface SettingsFormValues {
  username: string;
  phone: string;
  avatarId: MediaFile["id"] | null;
  locale: SupportedLocale | "system";
  openLastPartyOnLaunch: boolean;
  enableAIFeatures: boolean;
}

interface LocaleOption {
  id: SupportedLocale | "system";
  name: string;
}

function Settings() {
  const { partyList, updateSettings } = usePartyList();
  const navigate = useNavigate();

  const LOCALE_OPTIONS: LocaleOption[] = [
    { id: "system", name: t`System (fallbacks to ${DEFAULT_LOCALE})` },
    { id: "en", name: t`English` },
    { id: "es", name: t`Español` },
  ];

  function onSaveSettings(values: SettingsFormValues) {
    updateSettings({
      username: values.username,
      phone: values.phone,
      avatarId: values.avatarId,
      locale: values.locale === "system" ? undefined : values.locale,
      openLastPartyOnLaunch: values.openLastPartyOnLaunch,
      enableAIFeatures: values.enableAIFeatures,
    });
    form.reset();
    toast.success(t`Settings saved`);
    void navigate({ to: "..", replace: true });
  }

  const form = useForm({
    defaultValues: {
      username: partyList.username ?? "",
      phone: partyList.phone ?? "",
      avatarId: partyList.avatarId ?? null,
      locale: partyList.locale ?? ("system" as const),
      openLastPartyOnLaunch: partyList.openLastPartyOnLaunch ?? false,
      enableAIFeatures: partyList.enableAIFeatures ?? true,
    },
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
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
                  icon="#lucide/check"
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
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field name="avatarId">
          {(field) => (
            <form.Subscribe selector={(state) => state.values.username}>
              {([username]) => (
                <AvatarPicker
                  value={field.state.value}
                  name={username}
                  onChange={field.handleChange}
                />
              )}
            </form.Subscribe>
          )}
        </form.Field>

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

        <form.Field name="locale">
          {(field) => (
            <AppSelect<LocaleOption>
              label={t`Language`}
              items={LOCALE_OPTIONS}
              selectedKey={field.state.value}
              onSelectionChange={(value) => {
                if (value) {
                  field.handleChange(value as SupportedLocale);
                }
              }}
            >
              {(locale) => (
                <SelectItem key={locale.id} value={locale}>
                  {locale.name}
                </SelectItem>
              )}
            </AppSelect>
          )}
        </form.Field>

        <form.Field name="openLastPartyOnLaunch">
          {(field) => (
            <SwitchField
              label={<Trans>Open last party on launch</Trans>}
              description={
                <Trans>
                  Automatically open the last visited party when you open the
                  app
                </Trans>
              }
              isSelected={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>

        <form.Field name="enableAIFeatures">
          {(field) => (
            <SwitchField
              label={<Trans>Enable AI features</Trans>}
              description={
                <Trans>
                  Use AI to scan receipts and extract expense data. The AI model
                  (~100MB) runs locally on your device.
                </Trans>
              }
              isSelected={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </form>
    </div>
  );
}
