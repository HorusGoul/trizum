import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { CloudSyncAccountSettings } from "#src/components/CloudSyncAccountSettings.tsx";
import {
  CloudSyncSignInForm,
  type AuthPendingAction,
} from "#src/components/CloudSyncSignInForm.tsx";
import {
  AuthCallbackErrorDialog,
  CloudActionConfirmationDialog,
  CloudSyncSignInDialog,
  CloudSyncSwitchDialog,
  DeleteAccountDialog,
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
  type SocialAuthProvider,
} from "#src/lib/auth-client.ts";
import { clearCachedCloudUserSettings } from "#src/lib/cloudSyncSettings.ts";
import {
  clearCachedCloudAccountState,
  isEmailFieldErrorMessage,
  isPasswordFieldErrorMessage,
} from "#src/lib/cloudSyncRouteState.ts";
import { useCloudSyncAccountState } from "#src/hooks/useCloudSyncAccountState.ts";
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
const DELETE_ACCOUNT_CONFIRMATION_TEXT = "delete account";

interface CloudSyncSearchParams {
  auth?: "success";
  error?: string;
}

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
  const [authPendingAction, setAuthPendingAction] = useState<AuthPendingAction | null>(null);
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(true);
  const [cloudActionDialog, setCloudActionDialog] = useState<CloudActionDialogType | null>(null);
  const [authCallbackDialogError, setAuthCallbackDialogError] = useState<string | null>(null);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeleteAccountPending, setIsDeleteAccountPending] = useState(false);
  const isSignInSuccessVisibleRef = useRef(isSignInSuccessVisible);
  const isAuthPending = authPendingAction !== null;
  const canDeleteAccount =
    deleteAccountConfirmation.trim().toLowerCase() === DELETE_ACCOUNT_CONFIRMATION_TEXT;
  const {
    activateCloudSyncOnDevice,
    clearCloudSyncState,
    hasPasswordAccount,
    isCloudSyncSwitchOpen,
    linkedProviderIds,
    saveLinkedAccounts,
    setIsCloudSyncSwitchOpen,
  } = useCloudSyncAccountState({
    isSignInSuccessVisibleRef,
    onCloudDataActivated,
    partyList,
    userId,
  });

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
      setCloudActionDialog(null);
    }
  }, [userId]);

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
      saveLinkedAccounts(accounts);
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
      clearCloudSyncState();
      await session.refetch();
      toast.success(t`Signed out`);
      void navigate({ to: "/settings", replace: true });
    } catch {
      toast.error(t`Could not sign out`);
    } finally {
      setAuthPendingAction(null);
    }
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
      clearCloudSyncState();
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

  function onCloudDataActivated(shouldDelay: boolean) {
    if (shouldDelay) {
      window.setTimeout(() => {
        void navigate({ to: "/", replace: true });
      }, SIGN_IN_SUCCESS_ANIMATION_MS + SIGN_IN_SUCCESS_EXIT_ANIMATION_MS);
      return;
    }

    void navigate({ to: "/", replace: true });
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
          <CloudSyncSignInForm
            auth={auth}
            authEmail={authEmail}
            authEmailError={authEmailError}
            authError={authError}
            authPassword={authPassword}
            authPasswordError={authPasswordError}
            authPendingAction={authPendingAction}
            isAuthPending={isAuthPending}
            isPasswordLoginMode={isPasswordLoginMode}
            isPasswordResetMode={isPasswordResetMode}
            isPasswordSignInEnabled={isPasswordSignInEnabled}
            isSignInSuccessVisible={isSignInSuccessVisible}
            magicLinkMessage={magicLinkMessage}
            onAuthEmailChange={onAuthEmailChange}
            onAuthPasswordChange={onAuthPasswordChange}
            onBackToSignIn={() => {
              setIsPasswordResetMode(false);
              clearAuthFeedback();
            }}
            onForgotPassword={() => {
              setIsPasswordResetMode(true);
              clearAuthFeedback();
            }}
            onMagicLinkSubmit={onMagicLinkSubmit}
            onPasswordResetSubmit={onPasswordResetSubmit}
            onPasswordSignInSubmit={onPasswordSignInSubmit}
            onSocialSignIn={(provider) => {
              void onSocialSignIn(provider);
            }}
            onTryAnotherEmail={() => {
              clearAuthFeedback();
              setIsPasswordLoginMode(false);
            }}
            onUseMagicLink={() => {
              setIsPasswordLoginMode(false);
              setIsPasswordSignInEnabled(true);
              clearAuthFeedback();
            }}
            onUsePassword={() => {
              setIsPasswordLoginMode(true);
              setIsPasswordSignInEnabled(false);
              clearAuthFeedback();
            }}
            passwordResetMessage={passwordResetMessage}
          />
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
