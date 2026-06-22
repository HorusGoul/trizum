import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { CloudSyncAccountSettings } from "#src/components/CloudSyncAccountSettings.tsx";
import {
  AuthButtonIcon,
  AuthCallbackErrorDialog,
  AuthErrorAlert,
  CloudActionConfirmationDialog,
  CloudAuthLoadingState,
  CloudSyncSignInDialog,
  CloudSyncSwitchDialog,
  DeleteAccountDialog,
  MagicLinkSentState,
  SignInSuccessOverlay,
  type CloudActionDialogType,
} from "#src/components/CloudSyncDialogs.tsx";
import { getAuthCallbackErrorContent } from "#src/lib/authCallbackErrors.ts";
import { clearNativeAuthToken } from "#src/lib/nativeAuthSession.ts";
import {
  authClient,
  deleteAuthUserAccount,
  fetchLinkedAuthAccounts,
  getAuthRedirectUrl,
  getAuthResultUser,
  linkSocialAuthAccount,
  requestMagicLinkEmail,
  requestPasswordResetEmail,
  signInWithSocialAuthAccount,
  type AuthSessionUser,
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
import {
  clearCachedCloudAccountState,
  hasLocalPartyListData,
  isEmailFieldErrorMessage,
  isPasswordFieldErrorMessage,
  readCachedCloudAccountState,
  writeCachedCloudAccountState,
} from "#src/lib/cloudSyncRouteState.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { Settings } from "#src/routes/settings.tsx";
import { closeRouteState } from "#src/lib/navigationHistory.ts";

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

function CloudSyncSettings() {
  const { partyList } = usePartyList();
  const router = useRouter();
  const currentLocation = useLocation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { auth, error: authCallbackError } = Route.useSearch();
  const session = authClient.useSession();
  const sessionUser = session.data?.user;
  const [optimisticAuthUser, setOptimisticAuthUser] = useState<AuthSessionUser | null>(null);
  const user = sessionUser ?? optimisticAuthUser;
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
    if (sessionUser) {
      setOptimisticAuthUser(null);
    }
  }, [sessionUser]);

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

  function handleSignInSuccess(user: AuthSessionUser | undefined) {
    if (user) {
      setOptimisticAuthUser(user);
    }

    toast.success(t`Signed in`);
    setIsSignInSuccessVisible(true);
    void session.refetch();
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
      handleSignInSuccess(getAuthResultUser(result.data));
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

      const redirectUrl = getAuthRedirectUrl(result.data);

      if (redirectUrl) {
        window.location.replace(redirectUrl);
        return;
      }

      handleSignInSuccess(getAuthResultUser(result.data));
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
        window.location.replace(result.url);
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
      clearNativeAuthToken();
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
      closeRouteState(currentLocation, router.history, () => {
        void navigate({ to: "/settings", replace: true });
      });
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

      <CloudSyncAccountSettings
        email={user.email}
        hasPasswordAccount={hasPasswordAccount}
        isAuthPending={isAuthPending}
        isDeleteAccountPending={isDeleteAccountPending}
        linkedProviderIds={linkedProviderIds}
        onConnectApple={() => {
          setCloudActionDialog("connect-apple");
        }}
        onConnectGoogle={() => {
          setCloudActionDialog("connect-google");
        }}
        onDeleteAccount={openDeleteAccountDialog}
        onPasswordLink={() => {
          setCloudActionDialog("password-link");
        }}
        onSignOut={() => {
          setCloudActionDialog("sign-out");
        }}
        passwordResetMessage={passwordResetMessage}
      />

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

      <AnimatePresence>
        {isSignInSuccessVisible ? (
          <SignInSuccessOverlay exitAnimationMs={SIGN_IN_SUCCESS_EXIT_ANIMATION_MS} />
        ) : null}
      </AnimatePresence>

      <CloudSyncSwitchDialog
        isOpen={isCloudSyncSwitchOpen}
        onSignOut={onSignOut}
        onUseCloudData={() => {
          activateCloudSyncOnDevice();
        }}
      />
    </div>
  );
}

function getDeleteAccountErrorMessage(message: string) {
  if (message.toLowerCase().includes("session")) {
    return t`Sign in again before deleting your account`;
  }

  return message;
}
