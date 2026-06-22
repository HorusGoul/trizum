import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { getAuthCallbackErrorContent } from "#src/lib/authCallbackErrors.ts";
import {
  authClient,
  deleteAuthUserAccount,
  fetchLinkedAuthAccounts,
  linkSocialAuthAccount,
  requestMagicLinkEmail,
  requestPasswordResetEmail,
  signInWithSocialAuthAccount,
  type LinkedAuthAccount,
  type SocialAuthProvider,
} from "#src/lib/auth-client.ts";
import {
  clearCachedCloudUserSettings,
  fetchCloudUserSettings,
  getCloudUserSettingsInput,
  saveCloudUserSettings,
  writeCachedCloudUserSettings,
  type CloudUserSettings,
} from "#src/lib/cloudSyncSettings.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon, type IconProps } from "#src/ui/Icon.tsx";
import { Alert, AlertDescription } from "#src/ui/Alert.tsx";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetDescription,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "#src/ui/ModalSheet.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import type { PartyList } from "#src/models/partyList.js";
import { Settings } from "#src/routes/settings.tsx";

export const Route = createFileRoute("/settings_/cloud-sync")({
  validateSearch: (search: Record<string, unknown>): CloudSyncSearchParams => ({
    auth: search.auth === "success" ? "success" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: CloudSyncSettings,
});

const SIGN_IN_SUCCESS_ANIMATION_MS = 1200;
const SIGN_IN_SUCCESS_EXIT_ANIMATION_MS = 180;
const DIALOG_EXIT_ANIMATION_MS = 180;
const PASSWORD_SIGN_IN_ENABLE_DELAY_MS = 250;
const CLOUD_ACCOUNT_STATE_POLL_INTERVAL_MS = 30_000;
const CLOUD_ACCOUNT_STATE_CACHE_KEY_PREFIX = "trizumCloudAccountState:";
const DELETE_ACCOUNT_CONFIRMATION_TEXT = "delete account";
const AUTH_SECONDARY_BUTTON_CLASS_NAME =
  "h-9 text-sm font-medium text-accent-700 dark:text-accent-50";

interface CloudSyncSearchParams {
  auth?: "success";
  error?: string;
}

type AuthPendingAction =
  | "apple"
  | "google"
  | "magic-link"
  | "password"
  | "password-reset"
  | "sign-out";

type CloudActionDialogType = "connect-apple" | "connect-google" | "password-link" | "sign-out";

interface CachedCloudAccountState {
  cachedAt: number;
  cloudSettings: CloudUserSettings | null;
  linkedAccounts: LinkedAuthAccount[];
}

function CloudSyncSettings() {
  const { partyList } = usePartyList();
  const navigate = useNavigate({ from: Route.fullPath });
  const { auth, error: authCallbackError } = Route.useSearch();
  const session = authClient.useSession();
  const user = session.data?.user;
  const userId = user?.id;
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmailError, setAuthEmailError] = useState<string | null>(null);
  const [authPasswordError, setAuthPasswordError] = useState<string | null>(null);
  const [isPasswordLoginMode, setIsPasswordLoginMode] = useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [isPasswordSignInEnabled, setIsPasswordSignInEnabled] = useState(true);
  const [isSignInSuccessVisible, setIsSignInSuccessVisible] = useState(auth === "success");
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAuthAccount[]>([]);
  const [cloudSettings, setCloudSettings] = useState<CloudUserSettings | null>(null);
  const [authPendingAction, setAuthPendingAction] = useState<AuthPendingAction | null>(null);
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(true);
  const [isCloudSyncSwitchOpen, setIsCloudSyncSwitchOpen] = useState(false);
  const [cloudActionDialog, setCloudActionDialog] = useState<CloudActionDialogType | null>(null);
  const [authCallbackDialogError, setAuthCallbackDialogError] = useState<string | null>(null);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeleteAccountPending, setIsDeleteAccountPending] = useState(false);
  const partyListRef = useRef(partyList);
  const isSignInSuccessVisibleRef = useRef(isSignInSuccessVisible);
  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const isAuthPending = authPendingAction !== null;
  const hasPasswordAccount = linkedProviderIds.has("credential");
  const canDeleteAccount =
    deleteAccountConfirmation.trim().toLowerCase() === DELETE_ACCOUNT_CONFIRMATION_TEXT;

  useEffect(() => {
    partyListRef.current = partyList;
  }, [partyList]);

  useEffect(() => {
    isSignInSuccessVisibleRef.current = isSignInSuccessVisible;
  }, [isSignInSuccessVisible]);

  useEffect(() => {
    if (!user) {
      setIsSignInDialogOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (!userId) {
      setLinkedAccounts([]);
      setCloudSettings(null);
      setIsCloudSyncSwitchOpen(false);
      setCloudActionDialog(null);
      return;
    }

    let isCancelled = false;
    const currentUserId = userId;
    const cachedAccountState = readCachedCloudAccountState(currentUserId);

    if (cachedAccountState) {
      setLinkedAccounts(cachedAccountState.linkedAccounts);
      setCloudSettings(cachedAccountState.cloudSettings);
    } else {
      setLinkedAccounts([]);
      setCloudSettings(null);
    }

    void loadAccountState({
      showErrorToast: !cachedAccountState,
      showStartToast: true,
    });

    const intervalId = window.setInterval(() => {
      void loadAccountState({ showErrorToast: false, showStartToast: false });
    }, CLOUD_ACCOUNT_STATE_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };

    async function loadAccountState({
      showErrorToast,
      showStartToast,
    }: {
      showErrorToast: boolean;
      showStartToast: boolean;
    }) {
      try {
        const currentPartyList = partyListRef.current;
        const [accounts, { settings }] = await Promise.all([
          fetchLinkedAuthAccounts(),
          fetchCloudUserSettings(),
        ]);

        if (isCancelled) {
          return;
        }

        let activeSettings = settings;

        if (!activeSettings) {
          const { settings: savedSettings } = await saveCloudUserSettings(
            getCloudUserSettingsInput(currentPartyList),
          );

          if (isCancelled) {
            return;
          }

          activeSettings = savedSettings;
          if (showStartToast) {
            toast.success(t`trizum cloud started`);
          }
        }

        setLinkedAccounts(accounts);
        setCloudSettings(activeSettings);
        writeCachedCloudUserSettings(currentUserId, activeSettings);
        writeCachedCloudAccountState(currentUserId, {
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });

        if (!activeSettings) {
          return;
        }

        if (!isValidDocumentId(activeSettings.partyListDocumentId)) {
          toast.error(t`trizum cloud data is invalid`);
          return;
        }

        if (activeSettings.partyListDocumentId === currentPartyList.id) {
          return;
        }

        if (hasLocalPartyListData(currentPartyList)) {
          setIsCloudSyncSwitchOpen(true);
          return;
        }

        localStorage.setItem("partyListId", activeSettings.partyListDocumentId);
        setCloudSettings(activeSettings);
        setIsCloudSyncSwitchOpen(false);
        writeCachedCloudUserSettings(currentUserId, activeSettings);
        writeCachedCloudAccountState(currentUserId, {
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });
        toast.success(t`trizum cloud enabled on this device`);

        if (isSignInSuccessVisibleRef.current) {
          window.setTimeout(() => {
            void navigate({ to: "/", replace: true });
          }, SIGN_IN_SUCCESS_ANIMATION_MS + SIGN_IN_SUCCESS_EXIT_ANIMATION_MS);
          return;
        }

        void navigate({ to: "/", replace: true });
      } catch {
        if (!isCancelled && showErrorToast) {
          toast.error(t`Could not load trizum cloud state`);
        }
      }
    }
  }, [navigate, userId]);

  useEffect(() => {
    if (auth === "success") {
      setIsSignInSuccessVisible(true);
    }
  }, [auth]);

  useEffect(() => {
    if (!isSignInSuccessVisible || !userId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSignInSuccessVisible(false);

      if (auth === "success") {
        void navigate({ to: "/settings/cloud-sync", replace: true });
      }
    }, SIGN_IN_SUCCESS_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [auth, isSignInSuccessVisible, navigate, userId]);

  useEffect(() => {
    if (!userId && auth !== "success") {
      setIsSignInSuccessVisible(false);
    }
  }, [auth, userId]);

  useEffect(() => {
    if (!authCallbackError || userId) {
      return;
    }

    setAuthError(getAuthCallbackErrorContent(authCallbackError).description);
  }, [authCallbackError, userId]);

  useEffect(() => {
    if (!authCallbackError || !userId) {
      return;
    }

    setAuthCallbackDialogError(authCallbackError);
  }, [authCallbackError, userId]);

  useEffect(() => {
    if (!isPasswordLoginMode) {
      setIsPasswordSignInEnabled(true);
      return;
    }

    if (isPasswordSignInEnabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsPasswordSignInEnabled(true);
    }, PASSWORD_SIGN_IN_ENABLE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPasswordLoginMode, isPasswordSignInEnabled]);

  function clearAuthErrors() {
    setAuthError(null);
    setAuthEmailError(null);
    setAuthPasswordError(null);
  }

  function clearAuthFeedback() {
    clearAuthErrors();
    setMagicLinkMessage(null);
    setPasswordResetMessage(null);
  }

  function setAuthFailureMessage(message: string) {
    if (isEmailFieldErrorMessage(message)) {
      setAuthEmailError(message);
      return;
    }

    if (isPasswordFieldErrorMessage(message)) {
      setAuthPasswordError(message);
      return;
    }

    setAuthError(message);
  }

  function setAuthFailure(error: unknown, fallbackMessage: string) {
    setAuthFailureMessage(error instanceof Error ? error.message : fallbackMessage);
  }

  function onAuthEmailChange(value: string) {
    setAuthEmail(value);
    clearAuthErrors();
  }

  function onAuthPasswordChange(value: string) {
    setAuthPassword(value);
    setAuthError(null);
    setAuthPasswordError(null);
  }

  async function onMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearAuthErrors();
    setMagicLinkMessage(null);
    setPasswordResetMessage(null);
    setIsSignInSuccessVisible(false);
    setAuthPendingAction("magic-link");

    try {
      await requestMagicLinkEmail({
        email: authEmail,
        name: partyList.username.trim() || authEmail,
      });
      setMagicLinkMessage(t`Check your email for the sign-in link`);
      toast.success(t`Sign-in link sent`);
    } catch (error) {
      setAuthFailure(error, t`Could not send sign-in link`);
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function onPasswordSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isPasswordSignInEnabled) {
      return;
    }

    clearAuthErrors();
    setMagicLinkMessage(null);
    setPasswordResetMessage(null);
    setIsSignInSuccessVisible(false);
    setAuthPendingAction("password");

    try {
      const result = await authClient.signIn.email({
        email: authEmail,
        password: authPassword,
        rememberMe: true,
      });

      if (result.error) {
        setAuthFailureMessage(result.error.message ?? t`Authentication failed`);
        return;
      }

      setAuthPassword("");
      toast.success(t`Signed in`);
      setIsSignInSuccessVisible(true);
      await session.refetch();
    } catch (error) {
      setAuthFailureMessage(
        error instanceof Error && error.message.endsWith("sign-in is not configured.")
          ? t`Sign-in method is not configured`
          : error instanceof Error
            ? error.message
            : t`Authentication failed`,
      );
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function onSocialSignIn(provider: SocialAuthProvider) {
    clearAuthErrors();
    setMagicLinkMessage(null);
    setIsSignInSuccessVisible(false);
    setAuthPendingAction(provider);

    try {
      const result = await signInWithSocialAuthAccount(provider);

      if (result?.error) {
        setAuthError(result.error.message ?? t`Authentication failed`);
        return;
      }

      toast.success(t`Signed in`);
      setIsSignInSuccessVisible(true);
      await session.refetch();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t`Authentication failed`);
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function onLinkSocialAccount(provider: SocialAuthProvider) {
    clearAuthErrors();
    setAuthPendingAction(provider);

    try {
      const result = await linkSocialAuthAccount(provider);

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      const accounts = await fetchLinkedAuthAccounts();
      setLinkedAccounts(accounts);
      if (userId) {
        writeCachedCloudAccountState(userId, {
          cloudSettings,
          linkedAccounts: accounts,
        });
      }
      toast.success(t`Sign-in method connected`);
    } catch {
      toast.error(t`Could not connect sign-in method`);
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function onRequestPasswordReset(email: string) {
    clearAuthErrors();
    setPasswordResetMessage(null);
    setIsSignInSuccessVisible(false);
    setAuthPendingAction("password-reset");

    try {
      await requestPasswordResetEmail(email);
      setPasswordResetMessage(t`Check your email for the password link`);
      toast.success(t`Password email sent`);
    } catch (error) {
      setAuthFailure(error, t`Could not send password email`);
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function onPasswordResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRequestPasswordReset(authEmail);
  }

  async function onConfirmCloudAction(action: CloudActionDialogType) {
    if (!user) {
      return;
    }

    setCloudActionDialog(null);

    switch (action) {
      case "connect-apple":
        await onLinkSocialAccount("apple");
        return;
      case "connect-google":
        await onLinkSocialAccount("google");
        return;
      case "password-link":
        await onRequestPasswordReset(user.email);
        return;
      case "sign-out":
        await onSignOut();
        return;
    }
  }

  async function onSignOut() {
    setIsSignInSuccessVisible(false);
    setIsCloudSyncSwitchOpen(false);
    setCloudActionDialog(null);
    setAuthPendingAction("sign-out");

    try {
      await authClient.signOut();
      setCloudSettings(null);
      setLinkedAccounts([]);
      await session.refetch();
      toast.success(t`Signed out`);
      void navigate({ to: "/settings", replace: true });
    } catch {
      toast.error(t`Could not sign out`);
    } finally {
      setAuthPendingAction(null);
    }
  }

  function activateCloudSyncOnDevice(settings: CloudUserSettings | null = cloudSettings) {
    if (!settings) {
      toast.message(t`trizum cloud is not set up yet`);
      return;
    }

    if (!isValidDocumentId(settings.partyListDocumentId)) {
      toast.error(t`trizum cloud data is invalid`);
      return;
    }

    if (settings.partyListDocumentId === partyList.id) {
      toast.message(t`This device is already using trizum cloud`);
      return;
    }

    localStorage.setItem("partyListId", settings.partyListDocumentId);
    setCloudSettings(settings);
    setIsCloudSyncSwitchOpen(false);
    if (userId) {
      writeCachedCloudUserSettings(userId, settings);
      writeCachedCloudAccountState(userId, {
        cloudSettings: settings,
        linkedAccounts,
      });
    }
    toast.success(t`trizum cloud enabled on this device`);

    if (isSignInSuccessVisible) {
      window.setTimeout(() => {
        void navigate({ to: "/", replace: true });
      }, SIGN_IN_SUCCESS_ANIMATION_MS + SIGN_IN_SUCCESS_EXIT_ANIMATION_MS);
      return;
    }

    void navigate({ to: "/", replace: true });
  }

  function openDeleteAccountDialog() {
    setDeleteAccountConfirmation("");
    setDeleteAccountError(null);
    setIsDeleteAccountDialogOpen(true);
  }

  async function onDeleteAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canDeleteAccount) {
      return;
    }

    setDeleteAccountError(null);
    setIsDeleteAccountPending(true);

    try {
      await deleteAuthUserAccount();
      if (userId) {
        clearCachedCloudUserSettings(userId);
        clearCachedCloudAccountState(userId);
      }
      setCloudSettings(null);
      setLinkedAccounts([]);
      setIsCloudSyncSwitchOpen(false);
      setIsDeleteAccountDialogOpen(false);
      setDeleteAccountConfirmation("");
      await session.refetch();
      toast.success(t`Account deleted`);
      void navigate({ to: "/settings", replace: true });
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error
          ? getDeleteAccountErrorMessage(error.message)
          : t`Could not delete account`,
      );
    } finally {
      setIsDeleteAccountPending(false);
    }
  }

  function closeSignInDialog() {
    setIsSignInDialogOpen(false);
    window.setTimeout(() => {
      void navigate({ to: "/settings", replace: true });
    }, DIALOG_EXIT_ANIMATION_MS);
  }

  if (!user) {
    return (
      <div className="relative min-h-full">
        <div aria-hidden="true" className="min-h-full blur-[2px]">
          <Settings />
        </div>

        <CloudSyncSignInDialog
          isOpen={isSignInDialogOpen}
          onOpenChange={closeSignInDialog}
          showHeader={!magicLinkMessage && auth !== "success" && !isSignInSuccessVisible}
        >
          {auth === "success" || isSignInSuccessVisible ? (
            <CloudAuthLoadingState />
          ) : isPasswordResetMode ? (
            <form className="flex flex-col gap-4" onSubmit={onPasswordResetSubmit}>
              {authError ? <AuthErrorAlert message={authError} /> : null}
              <AppTextField
                errorMessage={authEmailError ?? undefined}
                isDisabled={isAuthPending}
                isInvalid={Boolean(authEmailError)}
                isRequired
                label={t`Email`}
                onChange={onAuthEmailChange}
                type="email"
                value={authEmail}
              />
              {passwordResetMessage ? (
                <p className="text-sm text-accent-700 dark:text-accent-50">
                  {passwordResetMessage}
                </p>
              ) : null}
              <Button color="accent" isDisabled={isAuthPending} type="submit">
                <span className="flex items-center gap-2">
                  <AuthButtonIcon
                    icon="lucide.mail"
                    isPending={authPendingAction === "password-reset"}
                  />
                  <Trans>Send password link</Trans>
                </span>
              </Button>
              <Button
                color="transparent"
                isDisabled={isAuthPending}
                onPress={() => {
                  setIsPasswordResetMode(false);
                  clearAuthFeedback();
                }}
                type="button"
              >
                <Trans>Back to sign in</Trans>
              </Button>
            </form>
          ) : magicLinkMessage ? (
            <MagicLinkSentState
              email={authEmail}
              message={magicLinkMessage}
              onTryAgain={() => {
                clearAuthFeedback();
                setIsPasswordLoginMode(false);
              }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <Button
                  color="input-like"
                  isDisabled={isAuthPending}
                  onPress={() => {
                    void onSocialSignIn("apple");
                  }}
                >
                  <span className="flex items-center gap-2">
                    <AuthButtonIcon icon="brand.apple" isPending={authPendingAction === "apple"} />
                    <Trans>Continue with Apple</Trans>
                  </span>
                </Button>
                <Button
                  color="input-like"
                  isDisabled={isAuthPending}
                  onPress={() => {
                    void onSocialSignIn("google");
                  }}
                >
                  <span className="flex items-center gap-2">
                    <AuthButtonIcon
                      icon="brand.google"
                      isPending={authPendingAction === "google"}
                    />
                    <Trans>Continue with Google</Trans>
                  </span>
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs font-medium uppercase text-accent-600 dark:text-accent-300">
                <span className="h-px flex-1 bg-accent-200 dark:bg-accent-700" />
                <Trans>or use email</Trans>
                <span className="h-px flex-1 bg-accent-200 dark:bg-accent-700" />
              </div>

              {isPasswordLoginMode ? (
                <form className="flex flex-col gap-4" onSubmit={onPasswordSignInSubmit}>
                  {authError ? <AuthErrorAlert message={authError} /> : null}
                  <AppTextField
                    errorMessage={authEmailError ?? undefined}
                    isDisabled={isAuthPending}
                    isInvalid={Boolean(authEmailError)}
                    isRequired
                    label={t`Email`}
                    onChange={onAuthEmailChange}
                    type="email"
                    value={authEmail}
                  />
                  <AppTextField
                    errorMessage={authPasswordError ?? undefined}
                    isDisabled={isAuthPending}
                    isInvalid={Boolean(authPasswordError)}
                    isRequired
                    label={t`Password`}
                    minLength={8}
                    onChange={onAuthPasswordChange}
                    type="password"
                    value={authPassword}
                  />
                  <Button
                    className="font-semibold"
                    color="accent"
                    isDisabled={isAuthPending || !isPasswordSignInEnabled}
                    type="submit"
                  >
                    <span className="flex items-center gap-2">
                      <AuthButtonIcon
                        icon="lucide.log-in"
                        isPending={authPendingAction === "password"}
                      />
                      <Trans>Sign in with password</Trans>
                    </span>
                  </Button>
                  <Button
                    color="input-like"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordLoginMode(false);
                      setIsPasswordSignInEnabled(true);
                      clearAuthFeedback();
                    }}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <Icon icon="lucide.mail" width={18} height={18} />
                      <Trans>Sign in with magic link</Trans>
                    </span>
                  </Button>
                  <Button
                    className={AUTH_SECONDARY_BUTTON_CLASS_NAME}
                    color="transparent"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordResetMode(true);
                      clearAuthFeedback();
                    }}
                    type="button"
                  >
                    <Trans>Forgot password?</Trans>
                  </Button>
                </form>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={onMagicLinkSubmit}>
                  {authError ? <AuthErrorAlert message={authError} /> : null}
                  <AppTextField
                    errorMessage={authEmailError ?? undefined}
                    isDisabled={isAuthPending}
                    isInvalid={Boolean(authEmailError)}
                    isRequired
                    label={t`Email`}
                    onChange={onAuthEmailChange}
                    type="email"
                    value={authEmail}
                  />
                  <Button color="accent" isDisabled={isAuthPending} type="submit">
                    <span className="flex items-center gap-2">
                      <AuthButtonIcon
                        icon="lucide.mail"
                        isPending={authPendingAction === "magic-link"}
                      />
                      <Trans>Email me a sign-in link</Trans>
                    </span>
                  </Button>
                  <Button
                    color="input-like"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordLoginMode(true);
                      setIsPasswordSignInEnabled(false);
                      clearAuthFeedback();
                    }}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <Icon icon="lucide.key-round" width={18} height={18} />
                      <Trans>Sign in with password</Trans>
                    </span>
                  </Button>
                </form>
              )}
            </>
          )}
        </CloudSyncSignInDialog>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/settings" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>trizum cloud</Trans>
        </h1>
      </div>

      <div className="container mt-4 flex flex-col gap-8 px-4 pb-8 pb-safe">
        <CloudSettingsSection icon="lucide.link" title={t`Connections`}>
          <CloudSettingsItem
            icon="brand.apple"
            title={t`Apple`}
            description={
              linkedProviderIds.has("apple")
                ? t`Apple is connected to this account`
                : t`Add Apple as a sign-in method`
            }
            statusLabel={linkedProviderIds.has("apple") ? t`Connected` : undefined}
            isConnected={linkedProviderIds.has("apple")}
            isDisabled={isAuthPending || linkedProviderIds.has("apple")}
            onPress={
              linkedProviderIds.has("apple")
                ? undefined
                : () => {
                    setCloudActionDialog("connect-apple");
                  }
            }
          />
          <CloudSettingsItem
            icon="brand.google"
            title={t`Google`}
            description={
              linkedProviderIds.has("google")
                ? t`Google is connected to this account`
                : t`Add Google as a sign-in method`
            }
            statusLabel={linkedProviderIds.has("google") ? t`Connected` : undefined}
            isConnected={linkedProviderIds.has("google")}
            isDisabled={isAuthPending || linkedProviderIds.has("google")}
            onPress={
              linkedProviderIds.has("google")
                ? undefined
                : () => {
                    setCloudActionDialog("connect-google");
                  }
            }
          />
        </CloudSettingsSection>

        <CloudSettingsSection icon="lucide.shield-check" title={t`Security`}>
          <CloudSettingsItem
            icon="lucide.mail"
            title={t`Email`}
            description={user.email}
            statusLabel={t`Signed in`}
            isConnected
          />
          <CloudSettingsItem
            icon="lucide.key-round"
            title={t`Password`}
            description={
              passwordResetMessage ??
              (hasPasswordAccount ? t`Email a password reset link` : t`Set up password sign-in`)
            }
            isDisabled={isAuthPending}
            onPress={() => {
              setCloudActionDialog("password-link");
            }}
          />
          <CloudSettingsItem
            icon="lucide.log-out"
            title={t`Sign out`}
            description={t`Stop trizum cloud on this device`}
            isDisabled={isAuthPending}
            onPress={() => {
              setCloudActionDialog("sign-out");
            }}
          />
        </CloudSettingsSection>

        <CloudSettingsSection icon="lucide.triangle-alert" title={t`Destructive actions`}>
          <CloudSettingsItem
            icon="lucide.trash-2"
            title={t`Delete account`}
            description={t`Permanently delete your trizum cloud account`}
            isDisabled={isDeleteAccountPending}
            onPress={openDeleteAccountDialog}
          />
        </CloudSettingsSection>
      </div>

      <CloudActionConfirmationDialog
        action={cloudActionDialog}
        email={user.email}
        hasPasswordAccount={hasPasswordAccount}
        isPending={isAuthPending}
        onConfirm={onConfirmCloudAction}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCloudActionDialog(null);
          }
        }}
      />

      <DeleteAccountDialog
        canSubmit={canDeleteAccount}
        confirmation={deleteAccountConfirmation}
        errorMessage={deleteAccountError}
        isOpen={isDeleteAccountDialogOpen}
        isPending={isDeleteAccountPending}
        onConfirmationChange={(value) => {
          setDeleteAccountConfirmation(value);
          setDeleteAccountError(null);
        }}
        onOpenChange={(isOpen) => {
          setIsDeleteAccountDialogOpen(isOpen);

          if (!isOpen) {
            setDeleteAccountConfirmation("");
            setDeleteAccountError(null);
          }
        }}
        onSubmit={onDeleteAccountSubmit}
      />

      <AuthCallbackErrorDialog
        error={authCallbackDialogError}
        isOpen={Boolean(authCallbackDialogError)}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            return;
          }

          setAuthCallbackDialogError(null);

          if (authCallbackError) {
            void navigate({ to: "/settings/cloud-sync", replace: true });
          }
        }}
      />

      <AnimatePresence>{isSignInSuccessVisible ? <SignInSuccessOverlay /> : null}</AnimatePresence>

      <ModalSheet
        isDismissable={false}
        isOpen={isCloudSyncSwitchOpen}
        onOpenChange={setIsCloudSyncSwitchOpen}
      >
        <ModalSheetHeader>
          <ModalSheetSection className="flex flex-col gap-2">
            <ModalSheetTitle>
              <Trans>Use trizum cloud on this device?</Trans>
            </ModalSheetTitle>
            <ModalSheetDescription>
              <Trans>
                This device already has local trizum data. Using trizum cloud here will switch this
                device to your cloud data, and the local list on this device will stop being used.
              </Trans>
            </ModalSheetDescription>
          </ModalSheetSection>
        </ModalSheetHeader>
        <ModalSheetContent>
          <ModalSheetActions>
            <ModalSheetAction
              icon="lucide.cloud-download"
              onPress={() => {
                activateCloudSyncOnDevice();
              }}
            >
              <Trans>Use cloud data</Trans>
            </ModalSheetAction>
            <ModalSheetAction icon="lucide.log-out" onPress={onSignOut} tone="danger">
              <Trans>Sign out</Trans>
            </ModalSheetAction>
          </ModalSheetActions>
        </ModalSheetContent>
      </ModalSheet>
    </div>
  );
}

function AuthCallbackErrorDialog({
  error,
  isOpen,
  onOpenChange,
}: {
  error: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const content = error ? getAuthCallbackErrorContent(error) : null;

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "w-full max-w-[420px] outline-none",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={content?.title ?? t`Authentication error`}
          className="rounded-lg border border-accent-200 bg-white shadow-2xl outline-none dark:border-accent-800 dark:bg-accent-950"
        >
          {content ? (
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-danger-50 text-danger-600 dark:bg-danger-950/50 dark:text-danger-300">
                  <Icon icon="lucide.circle-alert" width={20} height={20} />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-medium">{content.title}</h2>
                  <p className="text-sm text-accent-700 dark:text-accent-50">
                    {content.description}
                  </p>
                </div>
              </div>

              <Button
                className="font-semibold"
                color="accent"
                onPress={() => {
                  onOpenChange(false);
                }}
                type="button"
              >
                <Trans>Got it</Trans>
              </Button>
            </div>
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CloudSyncSignInDialog({
  children,
  isOpen,
  onOpenChange,
  showHeader,
}: {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: () => void;
  showHeader: boolean;
}) {
  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange();
        }
      }}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-stretch justify-center bg-accent-950/35 p-0 backdrop-blur-md sm:items-center sm:px-safe-or-4 sm:py-safe-offset-6",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "h-full w-full outline-none sm:h-auto sm:max-w-[420px]",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Sign in`}
          className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white shadow-2xl outline-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg sm:border sm:border-accent-200 dark:bg-accent-950 dark:sm:border-accent-800"
        >
          <IconButton
            aria-label={t`Back to settings`}
            className="absolute right-safe-offset-2 top-safe-offset-2 sm:right-2 sm:top-2"
            icon="lucide.x"
            onPress={onOpenChange}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-safe-offset-5 pt-safe-offset-14 px-safe-or-5 sm:p-6 sm:pt-14">
            {showHeader ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <img
                  alt=""
                  className="size-12 rounded-xl"
                  height={48}
                  src="/pwa-64x64.png"
                  width={48}
                />
                <h2 className="text-lg font-medium">
                  <Trans>Sign in to trizum cloud</Trans>
                </h2>
              </div>
            ) : null}

            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function AuthErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <Icon icon="lucide.circle-alert" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function AuthButtonIcon({ icon, isPending }: { icon: IconProps["icon"]; isPending: boolean }) {
  return (
    <Icon
      className={cn(isPending && "animate-spin")}
      icon={isPending ? "lucide.loader-circle" : icon}
      width={18}
      height={18}
    />
  );
}

function CloudAuthLoadingState() {
  return (
    <output
      aria-label={t`Finishing sign in`}
      className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center"
    >
      <motion.span
        animate={{ rotate: 360 }}
        className="flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50"
        transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
      >
        <Icon icon="lucide.loader-circle" width={24} height={24} />
      </motion.span>
      <p className="text-sm font-medium text-accent-700 dark:text-accent-50">
        <Trans>Finishing sign in</Trans>
      </p>
    </output>
  );
}

function MagicLinkSentState({
  email,
  message,
  onTryAgain,
}: {
  email: string;
  message: string;
  onTryAgain: () => void;
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <motion.span
        className="flex size-16 items-center justify-center rounded-full bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-200"
        initial={{ scale: 0.72 }}
        animate={{ scale: [0.72, 1.08, 1] }}
        transition={{ delay: 0.04, duration: 0.38, ease: "easeOut" }}
      >
        <Icon icon="lucide.mail-check" width={28} height={28} />
      </motion.span>
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium">{message}</h3>
        <p className="text-sm text-accent-700 dark:text-accent-50">
          <Trans>We sent a sign-in link to {email}. Open it to finish signing in.</Trans>
        </p>
      </div>
      <Button color="input-like" onPress={onTryAgain} type="button">
        <span className="flex items-center gap-2">
          <Icon icon="lucide.refresh-cw" width={18} height={18} />
          <Trans>Try another email</Trans>
        </span>
      </Button>
    </motion.div>
  );
}

function SignInSuccessAnimation() {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 px-5 py-8 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <motion.span
        className="flex size-16 items-center justify-center rounded-full bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-200"
        initial={{ scale: 0.6 }}
        animate={{ scale: [0.6, 1.1, 1] }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        <Icon icon="lucide.check" width={32} height={32} />
      </motion.span>
      <motion.p
        className="text-base font-medium"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2, ease: "easeOut" }}
      >
        <Trans>Signed in</Trans>
      </motion.p>
    </motion.div>
  );
}

function SignInSuccessOverlay() {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-white/90 backdrop-blur-md py-safe-offset-6 px-safe-or-4 dark:bg-accent-950/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: SIGN_IN_SUCCESS_EXIT_ANIMATION_MS / 1000, ease: "easeOut" }}
    >
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <SignInSuccessAnimation />
      </motion.div>
    </motion.div>
  );
}

function CloudSettingsSection({
  children,
  icon,
  title,
  tone = "default",
}: {
  children: ReactNode;
  icon: IconProps["icon"];
  title: string;
  tone?: "default" | "danger";
}) {
  return (
    <section className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center gap-2 px-1 text-sm font-semibold text-accent-700 dark:text-accent-200",
          tone === "danger" && "text-danger-600 dark:text-danger-300",
        )}
      >
        <Icon icon={icon} width={16} height={16} />
        <h2>{title}</h2>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function CloudSettingsItem({
  description,
  icon,
  isConnected,
  isDisabled,
  onPress,
  statusLabel,
  title,
  tone = "default",
}: {
  description?: ReactNode;
  icon: IconProps["icon"];
  isConnected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  statusLabel?: ReactNode;
  title: string;
  tone?: "default" | "danger";
}) {
  const content = (
    <span className="flex w-full items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50",
          tone === "danger" &&
            "bg-danger-50 text-danger-600 dark:bg-danger-950/50 dark:text-danger-300",
        )}
      >
        <Icon icon={icon} width={20} height={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "font-medium leading-tight",
            tone === "danger" && "text-danger-600 dark:text-danger-300",
          )}
        >
          {title}
        </span>
        {description ? (
          <span
            className={cn(
              "whitespace-normal break-words text-sm leading-snug text-accent-700 dark:text-accent-200",
              tone === "danger" && "text-danger-700 dark:text-danger-300",
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {onPress ? (
        <span
          className={cn(
            "ml-2 flex shrink-0 items-center gap-1 text-sm font-medium text-accent-700 dark:text-accent-100",
            tone === "danger" && "text-danger-600 dark:text-danger-300",
          )}
        >
          <Icon icon="lucide.chevron-right" width={18} height={18} />
        </span>
      ) : statusLabel ? (
        <span
          className={cn(
            "ml-2 shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900 dark:text-accent-100",
            tone === "danger" &&
              "bg-danger-50 text-danger-700 dark:bg-danger-950/50 dark:text-danger-300",
          )}
        >
          {statusLabel}
        </span>
      ) : isConnected ? (
        <Icon
          className="text-accent-600 dark:text-accent-200"
          icon="lucide.check"
          width={18}
          height={18}
        />
      ) : null}
    </span>
  );
  const className = cn(
    "-mx-3 h-auto min-h-16 w-[calc(100%+1.5rem)] justify-start rounded-xl px-3 py-3 text-left",
    "hover:bg-accent-100/70 dark:hover:bg-accent-900/70",
    tone === "danger" && "hover:bg-danger-50 dark:hover:bg-danger-950/40",
  );

  if (onPress) {
    return (
      <Button
        color="transparent"
        className={className}
        isDisabled={isDisabled}
        onPress={onPress}
        type="button"
      >
        {content}
      </Button>
    );
  }

  return (
    <div className="-mx-3 flex min-h-16 w-[calc(100%+1.5rem)] items-center rounded-xl px-3 py-3 text-left">
      {content}
    </div>
  );
}

function CloudActionConfirmationDialog({
  action,
  email,
  hasPasswordAccount,
  isPending,
  onConfirm,
  onOpenChange,
}: {
  action: CloudActionDialogType | null;
  email: string;
  hasPasswordAccount: boolean;
  isPending: boolean;
  onConfirm: (action: CloudActionDialogType) => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const config = action ? getCloudActionDialogConfig({ action, email, hasPasswordAccount }) : null;

  return (
    <ModalOverlay
      isDismissable={!isPending}
      isOpen={Boolean(action)}
      onOpenChange={onOpenChange}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "w-full max-w-[420px] outline-none",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={config?.title ?? t`Confirm action`}
          className="rounded-lg border border-accent-200 bg-white shadow-2xl outline-none dark:border-accent-800 dark:bg-accent-950"
        >
          {config && action ? (
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-3">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-50",
                    config.tone === "danger" &&
                      "bg-danger-50 text-danger-500 dark:bg-danger-950/50 dark:text-danger-300",
                  )}
                >
                  <Icon icon={config.icon} width={20} height={20} />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-medium">{config.title}</h2>
                  <p className="text-sm text-accent-700 dark:text-accent-50">
                    {config.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  className={cn(
                    "font-semibold",
                    config.tone === "danger" && "bg-danger-500 text-danger-50 dark:bg-danger-500",
                  )}
                  color="accent"
                  isDisabled={isPending}
                  onPress={() => {
                    void onConfirm(action);
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <AuthButtonIcon icon={config.icon} isPending={isPending} />
                    {config.actionLabel}
                  </span>
                </Button>
                <Button
                  color="input-like"
                  isDisabled={isPending}
                  onPress={() => {
                    onOpenChange(false);
                  }}
                  type="button"
                >
                  <Trans>Cancel</Trans>
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function getCloudActionDialogConfig({
  action,
  email,
  hasPasswordAccount,
}: {
  action: CloudActionDialogType;
  email: string;
  hasPasswordAccount: boolean;
}): {
  actionLabel: string;
  description: ReactNode;
  icon: IconProps["icon"];
  title: string;
  tone?: "danger";
} {
  switch (action) {
    case "connect-apple":
      return {
        actionLabel: t`Connect Apple`,
        description: (
          <Trans>
            trizum will open Apple so you can add it as a sign-in method for this account.
          </Trans>
        ),
        icon: "brand.apple",
        title: t`Connect Apple?`,
      };
    case "connect-google":
      return {
        actionLabel: t`Connect Google`,
        description: (
          <Trans>
            trizum will open Google so you can add it as a sign-in method for this account.
          </Trans>
        ),
        icon: "brand.google",
        title: t`Connect Google?`,
      };
    case "password-link":
      return {
        actionLabel: t`Email password link`,
        description: hasPasswordAccount ? (
          <Trans>
            We will email a password link to {email}. Your current password keeps working until you
            change it.
          </Trans>
        ) : (
          <Trans>
            We will email a password setup link to {email}. Password sign-in starts working after
            you add one.
          </Trans>
        ),
        icon: "lucide.key-round",
        title: hasPasswordAccount ? t`Email password link?` : t`Set up password?`,
      };
    case "sign-out":
      return {
        actionLabel: t`Sign out`,
        description: (
          <Trans>
            This stops trizum cloud on this device. Your local data stays on this device.
          </Trans>
        ),
        icon: "lucide.log-out",
        title: t`Sign out?`,
      };
  }
}

function DeleteAccountDialog({
  canSubmit,
  confirmation,
  errorMessage,
  isOpen,
  isPending,
  onConfirmationChange,
  onOpenChange,
  onSubmit,
}: {
  canSubmit: boolean;
  confirmation: string;
  errorMessage: string | null;
  isOpen: boolean;
  isPending: boolean;
  onConfirmationChange: (value: string) => void;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalOverlay
      isDismissable={!isPending}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "w-full max-w-[420px] outline-none",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Delete account`}
          className="rounded-lg border border-accent-200 bg-white shadow-2xl outline-none dark:border-accent-800 dark:bg-accent-950"
        >
          <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">
                <Trans>Delete account?</Trans>
              </h2>
              <p className="text-sm text-accent-700 dark:text-accent-50">
                <Trans>
                  This permanently deletes your trizum cloud account, sign-in methods, and cloud
                  settings. Your local data on this device will remain.
                </Trans>
              </p>
            </div>

            {errorMessage ? <AuthErrorAlert message={errorMessage} /> : null}

            <AppTextField
              description={t`Type "delete account" to confirm.`}
              isDisabled={isPending}
              label={t`Confirmation`}
              onChange={onConfirmationChange}
              value={confirmation}
            />

            <div className="flex flex-col gap-3">
              <Button
                className="bg-danger-500 text-danger-50 dark:bg-danger-500"
                color="accent"
                isDisabled={!canSubmit || isPending}
                type="submit"
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.trash-2" width={18} height={18} />
                  <Trans>Delete account</Trans>
                </span>
              </Button>
              <Button
                color="input-like"
                isDisabled={isPending}
                onPress={() => {
                  onOpenChange(false);
                }}
                type="button"
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function hasLocalPartyListData(partyList: PartyList) {
  return (
    hasRecordData(partyList.parties) ||
    hasRecordData(partyList.pinnedParties) ||
    hasRecordData(partyList.archivedParties) ||
    hasRecordData(partyList.lastUsedAt) ||
    Boolean(partyList.lastOpenedPartyId) ||
    Boolean(partyList.username.trim()) ||
    Boolean(partyList.phone.trim()) ||
    Boolean(partyList.avatarId) ||
    Boolean(partyList.locale) ||
    partyList.openLastPartyOnLaunch === true ||
    partyList.autoOpenCalculator === true ||
    partyList.hue !== undefined
  );
}

function hasRecordData(record: Record<string, unknown> | undefined) {
  return Object.values(record ?? {}).some(Boolean);
}

function getDeleteAccountErrorMessage(message: string) {
  if (message.toLowerCase().includes("session")) {
    return t`Sign in again before deleting your account`;
  }

  return message;
}

function isEmailFieldErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("email") &&
    !normalizedMessage.includes("password") &&
    (normalizedMessage.includes("invalid") ||
      normalizedMessage.includes("valid") ||
      normalizedMessage.includes("required"))
  );
}

function isPasswordFieldErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("password") &&
    !normalizedMessage.includes("email") &&
    (normalizedMessage.includes("invalid") ||
      normalizedMessage.includes("required") ||
      normalizedMessage.includes("short") ||
      normalizedMessage.includes("least"))
  );
}

function readCachedCloudAccountState(userId: string) {
  try {
    const value = localStorage.getItem(getCloudAccountStateCacheKey(userId));

    if (!value) {
      return null;
    }

    const cachedValue = JSON.parse(value) as Partial<CachedCloudAccountState> | null;

    if (!isCachedCloudAccountState(cachedValue)) {
      return null;
    }

    return cachedValue;
  } catch {
    return null;
  }
}

function writeCachedCloudAccountState(
  userId: string,
  state: Omit<CachedCloudAccountState, "cachedAt">,
) {
  try {
    localStorage.setItem(
      getCloudAccountStateCacheKey(userId),
      JSON.stringify({
        ...state,
        cachedAt: Date.now(),
      } satisfies CachedCloudAccountState),
    );
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function clearCachedCloudAccountState(userId: string) {
  try {
    localStorage.removeItem(getCloudAccountStateCacheKey(userId));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function getCloudAccountStateCacheKey(userId: string) {
  return `${CLOUD_ACCOUNT_STATE_CACHE_KEY_PREFIX}${userId}`;
}

function isCachedCloudAccountState(
  value: Partial<CachedCloudAccountState> | null,
): value is CachedCloudAccountState {
  if (!value || typeof value.cachedAt !== "number") {
    return false;
  }

  return (
    (value.cloudSettings === null ||
      (typeof value.cloudSettings === "object" &&
        typeof value.cloudSettings.updatedAt === "number" &&
        typeof value.cloudSettings.partyListDocumentId === "string" &&
        isValidDocumentId(value.cloudSettings.partyListDocumentId))) &&
    Array.isArray(value.linkedAccounts) &&
    value.linkedAccounts.every(isLinkedAuthAccount)
  );
}

function isLinkedAuthAccount(value: unknown): value is LinkedAuthAccount {
  if (!value || typeof value !== "object") {
    return false;
  }

  const account = value as Partial<LinkedAuthAccount>;

  return (
    typeof account.accountId === "string" &&
    typeof account.id === "string" &&
    typeof account.providerId === "string" &&
    typeof account.userId === "string"
  );
}
