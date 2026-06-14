import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { AvatarPicker } from "#src/components/AvatarPicker.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { validatePartyParticipantName, validatePhoneNumber } from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { MediaFile } from "#src/models/media.ts";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/i18n.js";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { SwitchField } from "#src/components/SwitchField.tsx";
import { ColorSlider, ColorThumb, SliderTrack } from "#src/ui/Color.tsx";
import { Label } from "#src/ui/fields/Field.js";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import {
  authClient,
  fetchLinkedAuthAccounts,
  getAuthSettingsCallbackURL,
  linkSocialAuthAccount,
  requestPasswordResetEmail,
  signInWithSocialAuthAccount,
  type LinkedAuthAccount,
  type SocialAuthProvider,
} from "#src/lib/auth-client.ts";
import {
  fetchCloudUserSettings,
  getCloudUserSettingsInput,
  saveCloudUserSettings,
  type CloudUserSettings,
} from "#src/lib/cloudSyncSettings.ts";
import type { PartyList } from "#src/models/partyList.ts";

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
  const { partyList, updateSettings, setCloudSyncState } = usePartyList();
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

      <div className="container mt-8 flex flex-col gap-4 px-4 pb-8 pb-safe">
        <CloudSyncSettingsSection
          partyList={partyList}
          setCloudSyncState={setCloudSyncState}
          updateSettings={updateSettings}
        />
      </div>
    </div>
  );
}

type PartyListApi = ReturnType<typeof usePartyList>;

interface CloudSyncSettingsSectionProps {
  partyList: PartyList;
  setCloudSyncState: PartyListApi["setCloudSyncState"];
  updateSettings: PartyListApi["updateSettings"];
}

function CloudSyncSettingsSection({
  partyList,
  setCloudSyncState,
  updateSettings,
}: CloudSyncSettingsSectionProps) {
  const session = authClient.useSession();
  const user = session.data?.user;
  const userId = user?.id;
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authName, setAuthName] = useState(partyList.username ?? "");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAuthAccount[]>([]);
  const [cloudSettings, setCloudSettings] = useState<CloudUserSettings | null>(null);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isCloudPending, setIsCloudPending] = useState(false);
  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const linkedProviderLabels = linkedAccounts
    .map((account) => getProviderLabel(account.providerId))
    .join(", ");
  const hasPasswordAccount = linkedProviderIds.has("credential");
  const lastSyncedAt = partyList.cloudSettingsSyncedAt
    ? new Date(partyList.cloudSettingsSyncedAt).toLocaleString()
    : null;

  useEffect(() => {
    if (!userId || !partyList.cloudSyncEnabled) {
      return;
    }

    let isCancelled = false;
    setIsCloudPending(true);

    void fetchCloudUserSettings()
      .then(({ settings }) => {
        if (!isCancelled) {
          setCloudSettings(settings);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          toast.error(t`Could not load cloud settings`);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCloudPending(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [partyList.cloudSyncEnabled, userId]);

  useEffect(() => {
    if (!userId) {
      setLinkedAccounts([]);
      return;
    }

    let isCancelled = false;

    void loadLinkedAccounts().catch(() => {
      if (!isCancelled) {
        toast.error(t`Could not load sign-in methods`);
      }
    });

    return () => {
      isCancelled = true;
    };

    async function loadLinkedAccounts() {
      const accounts = await fetchLinkedAuthAccounts();

      if (!isCancelled) {
        setLinkedAccounts(accounts);
      }
    }
  }, [userId]);

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setPasswordResetMessage(null);
    setIsAuthPending(true);

    try {
      const result =
        authMode === "sign-in"
          ? await authClient.signIn.email({
              email: authEmail,
              password: authPassword,
              rememberMe: true,
            })
          : await authClient.signUp.email({
              callbackURL: getAuthSettingsCallbackURL(),
              email: authEmail,
              name: authName || partyList.username || authEmail,
              password: authPassword,
            });

      if (result.error) {
        setAuthError(result.error.message ?? t`Authentication failed`);
        return;
      }

      setAuthPassword("");
      await session.refetch();
      toast.success(authMode === "sign-in" ? t`Signed in` : t`Account created`);
    } catch (error) {
      setAuthError(
        error instanceof Error && error.message.endsWith("sign-in is not configured.")
          ? t`Sign-in method is not configured`
          : error instanceof Error
            ? error.message
            : t`Authentication failed`,
      );
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onSocialSignIn(provider: SocialAuthProvider) {
    setAuthError(null);
    setIsAuthPending(true);

    try {
      const result = await signInWithSocialAuthAccount(provider);

      if (result?.error) {
        setAuthError(result.error.message ?? t`Authentication failed`);
        return;
      }

      await session.refetch();
      toast.success(t`Signed in`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t`Authentication failed`);
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onLinkSocialAccount(provider: SocialAuthProvider) {
    setAuthError(null);
    setIsAuthPending(true);

    try {
      const result = await linkSocialAuthAccount(provider);

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      setLinkedAccounts(await fetchLinkedAuthAccounts());
      toast.success(t`Sign-in method connected`);
    } catch {
      toast.error(t`Could not connect sign-in method`);
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onRequestPasswordReset(email: string) {
    setAuthError(null);
    setPasswordResetMessage(null);
    setIsAuthPending(true);

    try {
      await requestPasswordResetEmail(email);
      setPasswordResetMessage(t`Check your email for the password link`);
      toast.success(t`Password email sent`);
    } catch {
      setAuthError(t`Could not send password email`);
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onPasswordResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRequestPasswordReset(authEmail);
  }

  async function onSignOut() {
    setIsAuthPending(true);

    try {
      await authClient.signOut();
      setCloudSyncState({ cloudSyncEnabled: false });
      setCloudSettings(null);
      await session.refetch();
      toast.success(t`Signed out`);
    } catch {
      toast.error(t`Could not sign out`);
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onSaveCloudSettings() {
    setIsCloudPending(true);

    try {
      const { settings } = await saveCloudUserSettings(getCloudUserSettingsInput(partyList));
      setCloudSettings(settings);
      setCloudSyncState({
        cloudSettingsSyncedAt: settings.updatedAt,
        cloudSyncEnabled: true,
      });
      toast.success(t`Cloud settings saved`);
    } catch {
      toast.error(t`Could not save cloud settings`);
    } finally {
      setIsCloudPending(false);
    }
  }

  async function onApplyCloudSettings() {
    setIsCloudPending(true);

    try {
      const loadedSettings = cloudSettings ?? (await fetchCloudUserSettings()).settings;

      if (!loadedSettings) {
        toast.message(t`No cloud settings saved yet`);
        return;
      }

      updateSettings({
        autoOpenCalculator: loadedSettings.autoOpenCalculator,
        avatarId: partyList.avatarId ?? null,
        hue: loadedSettings.hue,
        locale: loadedSettings.locale ?? undefined,
        openLastPartyOnLaunch: loadedSettings.openLastPartyOnLaunch,
        phone: loadedSettings.phone,
        username: loadedSettings.username,
      });
      setCloudSyncState({
        cloudSettingsSyncedAt: loadedSettings.updatedAt,
        cloudSyncEnabled: true,
      });
      setCloudSettings(loadedSettings);
      toast.success(t`Cloud settings applied`);
    } catch {
      toast.error(t`Could not apply cloud settings`);
    } finally {
      setIsCloudPending(false);
    }
  }

  return (
    <section className="border-t border-accent-200 pt-6 dark:border-accent-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">
          <Trans>Cloud sync</Trans>
        </h2>
        <p className="text-sm text-accent-700 dark:text-accent-50">
          <Trans>Keep your profile settings available on your signed-in devices.</Trans>
        </p>
      </div>

      {user ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{user.name || user.email}</span>
            <span className="text-accent-700 dark:text-accent-50">{user.email}</span>
          </div>

          <div className="flex flex-col gap-3 border-b border-accent-200 pb-4 dark:border-accent-700">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">
                <Trans>Sign-in methods</Trans>
              </h3>
              <p className="text-sm text-accent-700 dark:text-accent-50">
                <Trans>Connect Google, Apple, or a password to the same account.</Trans>
              </p>
            </div>

            {linkedAccounts.length > 0 ? (
              <p className="text-sm text-accent-700 dark:text-accent-50">
                <Trans>Connected: {linkedProviderLabels}</Trans>
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                color="input-like"
                isDisabled={isAuthPending || linkedProviderIds.has("google")}
                onPress={() => {
                  void onLinkSocialAccount("google");
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.log-in" width={18} height={18} />
                  {linkedProviderIds.has("google") ? (
                    <Trans>Google connected</Trans>
                  ) : (
                    <Trans>Connect Google</Trans>
                  )}
                </span>
              </Button>
              <Button
                color="input-like"
                isDisabled={isAuthPending || linkedProviderIds.has("apple")}
                onPress={() => {
                  void onLinkSocialAccount("apple");
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.apple" width={18} height={18} />
                  {linkedProviderIds.has("apple") ? (
                    <Trans>Apple connected</Trans>
                  ) : (
                    <Trans>Connect Apple</Trans>
                  )}
                </span>
              </Button>
            </div>

            <Button
              color="transparent"
              isDisabled={isAuthPending}
              onPress={() => {
                void onRequestPasswordReset(user.email);
              }}
            >
              <span className="flex items-center gap-2">
                <Icon icon="lucide.mail" width={18} height={18} />
                {hasPasswordAccount ? (
                  <Trans>Email password reset link</Trans>
                ) : (
                  <Trans>Email password setup link</Trans>
                )}
              </span>
            </Button>

            {passwordResetMessage ? (
              <p className="text-sm text-accent-700 dark:text-accent-50">{passwordResetMessage}</p>
            ) : null}
          </div>

          <SwitchField
            label={<Trans>Sync profile settings</Trans>}
            description={
              <Trans>Username, phone, language, launch behavior, and accent color</Trans>
            }
            isDisabled={isCloudPending}
            isSelected={partyList.cloudSyncEnabled ?? false}
            onChange={(isSelected) => {
              if (!isSelected) {
                setCloudSyncState({ cloudSyncEnabled: false });
                return;
              }

              void onSaveCloudSettings();
            }}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button color="accent" isDisabled={isCloudPending} onPress={onSaveCloudSettings}>
              <span className="flex items-center gap-2">
                <Icon icon="lucide.cloud-upload" width={18} height={18} />
                <Trans>Save to cloud</Trans>
              </span>
            </Button>
            <Button color="input-like" isDisabled={isCloudPending} onPress={onApplyCloudSettings}>
              <span className="flex items-center gap-2">
                <Icon icon="lucide.cloud-download" width={18} height={18} />
                <Trans>Use cloud settings</Trans>
              </span>
            </Button>
          </div>

          {lastSyncedAt ? (
            <p className="text-sm text-accent-700 dark:text-accent-50">
              <Trans>Last synced {lastSyncedAt}</Trans>
            </p>
          ) : null}

          <Button color="transparent" isDisabled={isAuthPending} onPress={onSignOut}>
            <span className="flex items-center gap-2">
              <Icon icon="lucide.log-out" width={18} height={18} />
              <Trans>Sign out</Trans>
            </span>
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {isPasswordResetMode ? (
            <form className="flex flex-col gap-4" onSubmit={onPasswordResetSubmit}>
              <AppTextField
                isDisabled={isAuthPending}
                label={t`Email`}
                onChange={setAuthEmail}
                type="email"
                value={authEmail}
              />
              {authError ? <p className="text-sm text-danger-500">{authError}</p> : null}
              {passwordResetMessage ? (
                <p className="text-sm text-accent-700 dark:text-accent-50">
                  {passwordResetMessage}
                </p>
              ) : null}
              <Button color="accent" isDisabled={isAuthPending} type="submit">
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.mail" width={18} height={18} />
                  <Trans>Send password link</Trans>
                </span>
              </Button>
              <Button
                color="transparent"
                isDisabled={isAuthPending}
                onPress={() => {
                  setIsPasswordResetMode(false);
                  setAuthError(null);
                  setPasswordResetMessage(null);
                }}
              >
                <Trans>Back to sign in</Trans>
              </Button>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  color={authMode === "sign-in" ? "accent" : "input-like"}
                  onPress={() => setAuthMode("sign-in")}
                >
                  <Trans>Sign in</Trans>
                </Button>
                <Button
                  color={authMode === "sign-up" ? "accent" : "input-like"}
                  onPress={() => setAuthMode("sign-up")}
                >
                  <Trans>Create account</Trans>
                </Button>
              </div>

              <form className="flex flex-col gap-4" onSubmit={onAuthSubmit}>
                {authMode === "sign-up" ? (
                  <AppTextField
                    isDisabled={isAuthPending}
                    label={t`Name`}
                    maxLength={50}
                    minLength={1}
                    onChange={setAuthName}
                    value={authName}
                  />
                ) : null}
                <AppTextField
                  isDisabled={isAuthPending}
                  label={t`Email`}
                  onChange={setAuthEmail}
                  type="email"
                  value={authEmail}
                />
                <AppTextField
                  isDisabled={isAuthPending}
                  label={t`Password`}
                  minLength={8}
                  onChange={setAuthPassword}
                  type="password"
                  value={authPassword}
                />
                {authMode === "sign-in" ? (
                  <Button
                    color="transparent"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordResetMode(true);
                      setAuthError(null);
                      setPasswordResetMessage(null);
                    }}
                  >
                    <Trans>Forgot password?</Trans>
                  </Button>
                ) : null}
                {authError ? <p className="text-sm text-danger-500">{authError}</p> : null}
                <Button color="accent" isDisabled={isAuthPending} type="submit">
                  <span className="flex items-center gap-2">
                    <Icon icon="lucide.log-in" width={18} height={18} />
                    {authMode === "sign-in" ? (
                      <Trans>Sign in</Trans>
                    ) : (
                      <Trans>Create account</Trans>
                    )}
                  </span>
                </Button>
              </form>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  color="input-like"
                  isDisabled={isAuthPending}
                  onPress={() => {
                    void onSocialSignIn("google");
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="lucide.log-in" width={18} height={18} />
                    <Trans>Continue with Google</Trans>
                  </span>
                </Button>
                <Button
                  color="input-like"
                  isDisabled={isAuthPending}
                  onPress={() => {
                    void onSocialSignIn("apple");
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="lucide.apple" width={18} height={18} />
                    <Trans>Continue with Apple</Trans>
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function getProviderLabel(providerId: string) {
  switch (providerId) {
    case "apple":
      return t`Apple`;
    case "credential":
      return t`Password`;
    case "google":
      return t`Google`;
    default:
      return providerId;
  }
}
