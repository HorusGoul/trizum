import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { AvatarPicker } from "#src/components/AvatarPicker.js";
import { SwitchField } from "#src/components/SwitchField.tsx";
import { authClient } from "#src/lib/auth-client.ts";
import { fetchCloudUserSettings, type CloudUserSettings } from "#src/lib/cloudSyncSettings.ts";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/i18n.js";
import { validatePartyParticipantName, validatePhoneNumber } from "#src/lib/validation.js";
import type { MediaFile } from "#src/models/media.ts";
import { Button } from "#src/ui/Button.tsx";
import { ColorSlider, ColorThumb, SliderTrack } from "#src/ui/Color.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.js";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Label } from "#src/ui/fields/Field.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { usePartyList } from "#src/hooks/usePartyList.js";

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

function Settings() {
  const { partyList, updateSettings } = usePartyList();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const userId = session.data?.user?.id;
  const [cloudSettings, setCloudSettings] = useState<CloudUserSettings | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "loading" | "error">("idle");

  const LOCALE_OPTIONS: LocaleOption[] = [
    { id: "system", name: t`System (fallbacks to ${DEFAULT_LOCALE})` },
    { id: "en", name: t`English` },
    { id: "es", name: t`Español` },
  ];

  useEffect(() => {
    if (!userId) {
      setCloudSettings(null);
      setCloudSyncStatus("idle");
      return;
    }

    let isCancelled = false;
    setCloudSyncStatus("loading");

    void fetchCloudUserSettings()
      .then(({ settings }) => {
        if (!isCancelled) {
          setCloudSettings(settings);
          setCloudSyncStatus("idle");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCloudSyncStatus("error");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

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
      autoOpenCalculator: partyList.autoOpenCalculator ?? false,
      hue: partyList.hue ?? defaultThemeHue,
    },
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();
  const cloudSyncLabel = getCloudSyncLabel({
    cloudSettings,
    currentPartyListId: partyList.id,
    isSignedIn: Boolean(userId),
    status: cloudSyncStatus,
  });

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Settings</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}>
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
      </div>

      <div className="container mt-4 px-4">
        <Button
          color="input-like"
          className="h-auto min-h-16 justify-start rounded-lg px-4 py-3 text-left"
          onPress={() => {
            void navigate({ to: "/settings/cloud-sync" });
          }}
        >
          <span className="flex w-full items-center gap-3">
            <Icon icon="lucide.cloud" width={20} height={20} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium leading-none">
                <Trans>Cloud sync</Trans>
              </span>
              <span className="truncate text-sm text-accent-700 dark:text-accent-50">
                {cloudSyncLabel}
              </span>
            </span>
            <Icon icon="lucide.chevron-right" width={20} height={20} />
          </span>
        </Button>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="container mt-6 flex flex-col gap-6 px-4 pb-8 pb-safe"
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
              items={LOCALE_OPTIONS}
              selectedKey={field.state.value}
              onSelectionChange={(value) => {
                if (value) {
                  field.handleChange(value as SupportedLocale | "system");
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
      </form>
    </div>
  );
}

function getCloudSyncLabel({
  cloudSettings,
  currentPartyListId,
  isSignedIn,
  status,
}: {
  cloudSettings: CloudUserSettings | null;
  currentPartyListId: string;
  isSignedIn: boolean;
  status: "idle" | "loading" | "error";
}) {
  if (!isSignedIn) {
    return t`Not signed in`;
  }

  if (status === "loading") {
    return t`Checking...`;
  }

  if (status === "error") {
    return t`Could not load cloud sync state`;
  }

  if (!cloudSettings) {
    return t`Not set up`;
  }

  if (cloudSettings.partyListDocumentId === currentPartyListId) {
    return t`This device is synced`;
  }

  return t`Cloud sync available`;
}
