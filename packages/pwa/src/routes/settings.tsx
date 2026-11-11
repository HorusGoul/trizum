import { ProfileSettingsView, ProfileAnalyticsView } from "#src/lib/data/views.ts";
import { PaymentMethodsEditor } from "#src/components/PaymentMethodsEditor.tsx";
import {
  getPaymentMethods,
  normalizePaymentMethods,
  validatePaymentMethod,
} from "#src/lib/paymentMethods.ts";
import { paymentMethodTypes, type PaymentMethods } from "#src/models/paymentMethod.ts";
import { setAnalyticsEnabled, trackEvent } from "#src/lib/analytics.ts";
import { OfflineAccountNotice } from "#src/components/OfflineAccountNotice.tsx";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Capacitor } from "@capacitor/core";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { AvatarPicker } from "#src/components/AvatarPicker.js";
import { SwitchField } from "@trizum/ui/SwitchField";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/locales.js";
import { validatePartyParticipantName } from "#src/lib/validation.js";
import type { MediaFile } from "#src/models/media.ts";
import { ColorSlider, ColorThumb, SliderTrack } from "@trizum/ui/Color";
import { IconButton } from "@trizum/ui/IconButton";
import { Button } from "@trizum/ui/Button";
import { AppSelect, SelectItem } from "@trizum/ui/Select";
import { Label } from "@trizum/ui/fields/Field";
import { AppTextField } from "@trizum/ui/fields/TextField";
import { defaultThemeHue, setThemeHue } from "@trizum/ui/theme";
import { usePartyList } from "#src/hooks/usePartyList.js";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import { useAdvertising } from "#src/lib/advertising/AdvertisingContext.ts";
import { useAppSession } from "#src/lib/auth-client.ts";
import { getAuthSessionStatus, type AuthSessionStatus } from "#src/lib/authSessionStatus.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

interface SettingsFormValues {
  username: string;
  paymentMethods: PaymentMethods;
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
  const { partyList, updateSettings } = usePartyList(ProfileSettingsView);
  const navigate = useNavigate();
  const localeOptions = getLocaleOptions();

  async function onSaveSettings(values: SettingsFormValues) {
    await updateSettings({
      username: values.username,
      phone: values.paymentMethods.bizum?.trim() ?? "",
      paymentMethods: normalizePaymentMethods(values.paymentMethods),
      avatarId: values.avatarId,
      locale: values.locale === "system" ? undefined : values.locale,
      openLastPartyOnLaunch: values.openLastPartyOnLaunch,
      autoOpenCalculator: values.autoOpenCalculator,
      hue: values.hue,
    });
    trackEvent("settings_saved");
    form.reset(values);
    toast.success(t`Settings saved`);
    void navigate({ to: "..", replace: true });
  }

  const form = useForm({
    defaultValues: {
      username: partyList.username ?? "",
      paymentMethods: getPaymentMethods(partyList),
      avatarId: partyList.avatarId ?? null,
      locale: partyList.locale ?? ("system" as const),
      openLastPartyOnLaunch: partyList.openLastPartyOnLaunch ?? false,
      autoOpenCalculator: partyList.autoOpenCalculator ?? false,
      hue: partyList.hue ?? defaultThemeHue,
    },
    onSubmit: ({ value }) => {
      return onSaveSettings(value);
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
      className="pb-safe-offset-8 container mt-6 flex flex-col gap-6 px-4"
    >
      <OfflineAccountNotice />
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
        name="paymentMethods"
        validators={{
          onChange: ({ value }) =>
            paymentMethodTypes
              .filter((type) => value[type] !== undefined)
              .map((type) => validatePaymentMethod(type, value[type]!))
              .find(Boolean),
        }}
      >
        {(field) => (
          <PaymentMethodsEditor value={field.state.value} onChange={field.handleChange} />
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
                // SAFETY: The select contains supported locales plus system; React Aria widens those declared item keys.
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

      <PremiumSection />

      <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-3 border-t pt-6">
        <h2 className="text-accent-900 dark:text-accent-100 text-lg font-semibold">
          <Trans>Privacy</Trans>
        </h2>
        <UsageAnalyticsSetting />
        {privacyOptionsRequired ? (
          <Button type="button" color="input-like" pressAction={showPrivacyOptions}>
            <Trans>Privacy and cookie settings</Trans>
          </Button>
        ) : null}
      </section>
    </form>
  );
}

function UsageAnalyticsSetting() {
  const { partyList, setUsageAnalyticsEnabled } = usePartyList(ProfileAnalyticsView);

  return (
    <SwitchField
      label={<Trans>Share usage analytics</Trans>}
      description={<Trans>Help us understand how trizum is used.</Trans>}
      isSelected={partyList.usageAnalyticsEnabled !== false}
      onChange={async (enabled) => {
        if (!enabled) setAnalyticsEnabled(false);
        await setUsageAnalyticsEnabled(enabled);
      }}
    />
  );
}

function PremiumSection() {
  const session = useAppSession();
  const navigate = useNavigate();
  const { isPremium, presentCustomerCenter, presentPaywall, status } = usePremium();
  const { registerProtectedFlow } = useAdvertising();

  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const sessionStatus = getAuthSessionStatus(session);
  const isSignedIn = sessionStatus === "signed-in";
  const isLoading = sessionStatus === "pending" || status === "loading";

  async function openPremium() {
    if (sessionStatus === "unavailable") {
      await session.refetch();

      return;
    }

    if (sessionStatus === "pending") {
      return;
    }

    if (!isSignedIn) {
      await navigate({ to: "/settings/cloud-sync" });

      return;
    }

    const unregisterProtectedFlow = registerProtectedFlow();

    try {
      if (isPremium) {
        await presentCustomerCenter();
      } else {
        await presentPaywall();
      }
    } catch {
      toast.error(t`Could not open Premium. Please try again.`);
    }

    unregisterProtectedFlow();
  }

  return (
    <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-accent-900 dark:text-accent-100 text-lg font-semibold">
          <Trans>Premium</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300 text-sm">
          <PremiumStatusDescription
            isLoading={isLoading}
            isPremium={isPremium}
            sessionStatus={sessionStatus}
            status={status}
          />
        </p>
      </div>
      <Button
        type="button"
        color="input-like"
        isDisabled={isLoading}
        onPress={sessionStatus === "unavailable" ? undefined : () => void openPremium()}
        pressAction={sessionStatus === "unavailable" ? openPremium : undefined}
      >
        {sessionStatus === "pending" ? (
          <Trans>Checking account…</Trans>
        ) : sessionStatus === "unavailable" ? (
          <Trans>Retry account check</Trans>
        ) : isSignedIn ? (
          isPremium ? (
            <Trans>Manage Premium</Trans>
          ) : (
            <Trans>View Premium options</Trans>
          )
        ) : (
          <Trans>Sign in to get Premium</Trans>
        )}
      </Button>
    </section>
  );
}

function PremiumStatusDescription({
  isLoading,
  isPremium,
  sessionStatus,
  status,
}: {
  isLoading: boolean;
  isPremium: boolean;
  sessionStatus: AuthSessionStatus;
  status: ReturnType<typeof usePremium>["status"];
}) {
  if (isLoading) {
    return <Trans>Checking Premium status…</Trans>;
  }

  if (sessionStatus === "unavailable") {
    return <Trans>Your account could not be checked. Connect to the internet and try again.</Trans>;
  }

  if (sessionStatus === "signed-out") {
    return <Trans>Sign in to purchase or restore Premium across your devices.</Trans>;
  }

  if (isPremium) {
    return <Trans>Premium is active on this account.</Trans>;
  }

  if (status === "error") {
    return <Trans>Premium status could not be checked. Try again.</Trans>;
  }

  return <Trans>Choose monthly, annual, or lifetime access.</Trans>;
}
