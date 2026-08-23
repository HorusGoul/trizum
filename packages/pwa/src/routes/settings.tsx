import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { AvatarPicker } from "#src/components/AvatarPicker.js";
import { SwitchField } from "#src/components/SwitchField.tsx";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/locales.js";
import { validatePartyParticipantName, validatePhoneNumber } from "#src/lib/validation.js";
import type { MediaFile } from "#src/models/media.ts";
import { ColorSlider, ColorThumb, SliderTrack } from "#src/ui/Color.tsx";
import { IconButton } from "#src/ui/IconButton.js";
import { Button } from "#src/ui/Button.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Label } from "#src/ui/fields/Field.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { usePartyList } from "#src/hooks/usePartyList.js";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { useAdvertising } from "#src/lib/advertising/AdvertisingContext.ts";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

interface SettingsFormValues {
  username: string;
  phone: string;
  avatarId: MediaFile["id"] | null;
  locale: SupportedLocale | "system";
  openLastPartyOnLaunch: boolean;
  autoOpenCalculator: boolean;
  hue: number;
}

interface LocaleOption {
  id: SupportedLocale | "system";
  name: string;
}

function getLocaleOptions(): LocaleOption[] {
  return [
    { id: "system", name: t`System (fallbacks to ${DEFAULT_LOCALE})` },
    { id: "en", name: t`English` },
    { id: "es", name: t`Español` },
  ];
}

export function Settings() {
  const { partyList, updateSettings } = usePartyList();
  const navigate = useNavigate();
  const localeOptions = getLocaleOptions();

  function onSaveSettings(values: SettingsFormValues) {
    updateSettings({
      username: values.username,
      phone: values.phone,
      avatarId: values.avatarId,
      locale: values.locale === "system" ? undefined : values.locale,
      openLastPartyOnLaunch: values.openLastPartyOnLaunch,
      autoOpenCalculator: values.autoOpenCalculator,
      hue: values.hue,
    });
    form.reset(values);
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
      autoOpenCalculator: partyList.autoOpenCalculator ?? false,
      hue: partyList.hue ?? defaultThemeHue,
    },
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <SettingsHeader
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

      <SettingsFormFields form={form} formId={formId} localeOptions={localeOptions} />
    </div>
  );
}

function SettingsHeader({ submitButton }: { submitButton: React.ReactNode }) {
  return (
    <div className="mt-safe container flex h-16 items-center px-2">
      <BackButton fallbackOptions={{ to: "/" }} />

      <h1 className="max-h-12 truncate px-4 text-xl font-medium">
        <Trans>Settings</Trans>
      </h1>

      <div className="flex-1" />
      {submitButton}
    </div>
  );
}

function SettingsFormFields({
  form,
  formId,
  localeOptions,
}: {
  form: AppFormApi<SettingsFormValues>;
  formId: string;
  localeOptions: LocaleOption[];
}) {
  const { privacyOptionsRequired, showPrivacyOptions } = useAdvertising();

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="pb-safe container mt-6 flex flex-col gap-6 px-4 pb-8"
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
            isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
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
            isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
          />
        )}
      </form.Field>

      <form.Field name="locale">
        {(field) => (
          <AppSelect<LocaleOption>
            label={t`Language`}
            items={localeOptions}
            selectedKey={field.state.value}
            onSelectionChange={(value) => {
              if (value) {
                field.handleChange(value as SupportedLocale | "system");
              }
            }}
          >
            {(locale) => (
              <SelectItem key={locale.id} value={locale} textValue={locale.name}>
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
              <Trans>Automatically open the last visited party when you open the app</Trans>
            }
            isSelected={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="autoOpenCalculator">
        {(field) => (
          <SwitchField
            label={<Trans>Auto-open calculator</Trans>}
            description={
              <Trans>Automatically open the calculator when focusing amount fields</Trans>
            }
            isSelected={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="hue">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>{t`Accent color`}</Label>
            <ColorSlider
              id={field.name}
              value={`hsl(${field.state.value}, 100%, 50%)`}
              onChange={(value) => {
                const hue = value.getChannelValue("hue");
                field.setValue(hue);
                setThemeHue(hue);
              }}
              channel="hue"
              className="w-full"
            >
              <SliderTrack className="w-full">
                <ColorThumb className="top-1/2" />
              </SliderTrack>
            </ColorSlider>
          </div>
        )}
      </form.Field>

      {privacyOptionsRequired ? (
        <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-3 border-t pt-6">
          <h2 className="text-accent-900 dark:text-accent-100 text-lg font-semibold">
            <Trans>Privacy</Trans>
          </h2>
          <Button type="button" color="input-like" pressAction={showPrivacyOptions}>
            <Trans>Privacy and cookie settings</Trans>
          </Button>
        </section>
      ) : null}
    </form>
  );
}
