import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, type FormEvent } from "react";
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
import { closeRouteState } from "#src/lib/navigationHistory.ts";

export const Route = createFileRoute("/_home/settings_/cloud-sync")({
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

interface CloudSyncRouteState {
  optimisticAuthUser: AuthSessionUser | null;
  authEmail: string;
  authPassword: string;
  authError: string | null;
  authEmailError: string | null;
  authPasswordError: string | null;
  isPasswordLoginMode: boolean;
  isPasswordResetMode: boolean;
  isPasswordSignInEnabled: boolean;
  isSignInSuccessAnimationComplete: boolean;
  isSignInSuccessVisible: boolean;
  magicLinkMessage: string | null;
  passwordResetMessage: string | null;
  authPendingAction: AuthPendingAction | null;
  isSignInDialogOpen: boolean;
  cloudActionDialog: CloudActionDialogType | null;
  authCallbackDialogError: string | null;
  isDeleteAccountDialogOpen: boolean;
  deleteAccountConfirmation: string;
  deleteAccountError: string | null;
  isDeleteAccountPending: boolean;
}

type CloudSyncRouteAction =
  | { type: "patch"; values: Partial<CloudSyncRouteState> }
  | { type: "authEmailChanged"; value: string }
  | { type: "authPasswordChanged"; value: string }
  | { type: "authFailureMessage"; message: string }
  | { type: "clearAuthErrors" }
  | { type: "clearAuthFeedback" }
  | { type: "sessionUserResolved" }
  | { type: "signInSucceeded"; user: AuthSessionUser | undefined }
  | { type: "deleteAccountDialogOpened" }
  | { type: "deleteAccountDialogOpenChanged"; isOpen: boolean }
  | { type: "deleteAccountConfirmationChanged"; value: string };

function createInitialCloudSyncRouteState({
  auth,
  error,
}: CloudSyncSearchParams): CloudSyncRouteState {
  return {
    optimisticAuthUser: null,
    authEmail: "",
    authPassword: "",
    authError: error ? getAuthCallbackErrorContent(error).description : null,
    authEmailError: null,
    authPasswordError: null,
    isPasswordLoginMode: false,
    isPasswordResetMode: false,
    isPasswordSignInEnabled: true,
    isSignInSuccessAnimationComplete: false,
    isSignInSuccessVisible: auth === "success",
    magicLinkMessage: null,
    passwordResetMessage: null,
    authPendingAction: null,
    isSignInDialogOpen: true,
    cloudActionDialog: null,
    authCallbackDialogError: error ?? null,
    isDeleteAccountDialogOpen: false,
    deleteAccountConfirmation: "",
    deleteAccountError: null,
    isDeleteAccountPending: false,
  };
}

function cloudSyncRouteReducer(
  state: CloudSyncRouteState,
  action: CloudSyncRouteAction,
): CloudSyncRouteState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.values };
    case "authEmailChanged":
      return {
        ...state,
        authEmail: action.value,
        authError: null,
        authEmailError: null,
        authPasswordError: null,
      };
    case "authPasswordChanged":
      return {
        ...state,
        authPassword: action.value,
        authError: null,
        authPasswordError: null,
      };
    case "authFailureMessage":
      if (isEmailFieldErrorMessage(action.message)) {
        return {
          ...state,
          authEmailError: action.message,
        };
      }

      if (isPasswordFieldErrorMessage(action.message)) {
        return {
          ...state,
          authPasswordError: action.message,
        };
      }

      return {
        ...state,
        authError: action.message,
      };
    case "clearAuthErrors":
      return {
        ...state,
        authError: null,
        authEmailError: null,
        authPasswordError: null,
      };
    case "clearAuthFeedback":
      return {
        ...state,
        authError: null,
        authEmailError: null,
        authPasswordError: null,
        magicLinkMessage: null,
        passwordResetMessage: null,
      };
    case "sessionUserResolved":
      return {
        ...state,
        optimisticAuthUser: null,
      };
    case "signInSucceeded":
      return {
        ...state,
        optimisticAuthUser: action.user ?? state.optimisticAuthUser,
        isSignInSuccessAnimationComplete: false,
        isSignInSuccessVisible: true,
      };
    case "deleteAccountDialogOpened":
      return {
        ...state,
        deleteAccountConfirmation: "",
        deleteAccountError: null,
        isDeleteAccountDialogOpen: true,
      };
    case "deleteAccountDialogOpenChanged":
      if (action.isOpen) {
        return {
          ...state,
          isDeleteAccountDialogOpen: true,
        };
      }

      return {
        ...state,
        deleteAccountConfirmation: "",
        deleteAccountError: null,
        isDeleteAccountDialogOpen: false,
      };
    case "deleteAccountConfirmationChanged":
      return {
        ...state,
        deleteAccountConfirmation: action.value,
        deleteAccountError: null,
      };
  }
}

function CloudSyncSettings() {
  return useCloudSyncSettingsView();
}

function useCloudSyncSettingsView() {
  const { partyList } = usePartyList();
  const router = useRouter();
  const currentLocation = useLocation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { auth, error: authCallbackError } = Route.useSearch();
  const session = authClient.useSession();
  const sessionUser = session.data?.user;
  const [routeState, dispatchRouteState] = useReducer(
    cloudSyncRouteReducer,
    { auth, error: authCallbackError },
    createInitialCloudSyncRouteState,
  );
  const {
    optimisticAuthUser,
    authEmail,
    authPassword,
    authError,
    authEmailError,
    authPasswordError,
    isPasswordLoginMode,
    isPasswordResetMode,
    isPasswordSignInEnabled,
    isSignInSuccessAnimationComplete,
    magicLinkMessage,
    passwordResetMessage,
    authPendingAction,
    isSignInDialogOpen,
    cloudActionDialog,
    authCallbackDialogError,
    isDeleteAccountDialogOpen,
    deleteAccountConfirmation,
    deleteAccountError,
    isDeleteAccountPending,
  } = routeState;
  const user = sessionUser ?? optimisticAuthUser;
  const userId = user?.id;
  const isSignInSuccessVisible =
    userId || auth === "success" ? routeState.isSignInSuccessVisible || auth === "success" : false;
  const isSignInSuccessVisibleRef = useRef(isSignInSuccessVisible);
  const isAuthPending = authPendingAction !== null;
  const signInFormMode = isPasswordResetMode
    ? "password-reset"
    : isPasswordLoginMode
      ? "password"
      : "magic-link";
  const canDeleteAccount =
    deleteAccountConfirmation.trim().toLowerCase() === DELETE_ACCOUNT_CONFIRMATION_TEXT;
  const {
    activateCloudSyncOnDevice,
    clearCloudSyncState,
    hasPasswordAccount,
    isAccountStateResolved,
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
    if (sessionUser) {
      dispatchRouteState({ type: "sessionUserResolved" });
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!isSignInSuccessVisible || !userId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatchRouteState({
        type: "patch",
        values: {
          isSignInSuccessAnimationComplete: true,
        },
      });
    }, SIGN_IN_SUCCESS_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSignInSuccessVisible, userId]);

  useEffect(() => {
    if (
      !isSignInSuccessVisible ||
      !isSignInSuccessAnimationComplete ||
      !isAccountStateResolved ||
      isCloudSyncSwitchOpen
    ) {
      return;
    }

    void navigate({ to: "/", replace: true });
  }, [
    isAccountStateResolved,
    isCloudSyncSwitchOpen,
    isSignInSuccessAnimationComplete,
    isSignInSuccessVisible,
    navigate,
  ]);

  useEffect(() => {
    if (!isPasswordLoginMode) {
      dispatchRouteState({
        type: "patch",
        values: {
          isPasswordSignInEnabled: true,
        },
      });
      return;
    }

    if (isPasswordSignInEnabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatchRouteState({
        type: "patch",
        values: {
          isPasswordSignInEnabled: true,
        },
      });
    }, PASSWORD_SIGN_IN_ENABLE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPasswordLoginMode, isPasswordSignInEnabled]);

  function clearAuthErrors() {
    dispatchRouteState({ type: "clearAuthErrors" });
  }

  function clearAuthFeedback() {
    dispatchRouteState({ type: "clearAuthFeedback" });
  }

  function clearAuthPendingAction() {
    dispatchRouteState({
      type: "patch",
      values: {
        authPendingAction: null,
      },
    });
  }

  function setAuthFailureMessage(message: string) {
    dispatchRouteState({ type: "authFailureMessage", message });
  }

  function setAuthFailure(error: unknown, fallbackMessage: string) {
    setAuthFailureMessage(error instanceof Error ? error.message : fallbackMessage);
  }

  function handleSignInSuccess(user: AuthSessionUser | undefined) {
    toast.success(t`Signed in`);
    dispatchRouteState({ type: "signInSucceeded", user });
    void session.refetch();
  }

  function onAuthEmailChange(value: string) {
    dispatchRouteState({ type: "authEmailChanged", value });
  }

  function onAuthPasswordChange(value: string) {
    dispatchRouteState({ type: "authPasswordChanged", value });
  }

  async function onMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatchRouteState({
      type: "patch",
      values: {
        authError: null,
        authEmailError: null,
        authPasswordError: null,
        magicLinkMessage: null,
        passwordResetMessage: null,
        isSignInSuccessVisible: false,
        authPendingAction: "magic-link",
      },
    });

    try {
      await requestMagicLinkEmail({
        email: authEmail,
        name: partyList.username.trim() || authEmail,
      });
      dispatchRouteState({
        type: "patch",
        values: {
          magicLinkMessage: t`Check your email for the sign-in link`,
        },
      });
      toast.success(t`Sign-in link sent`);
    } catch (error) {
      setAuthFailure(error, t`Could not send sign-in link`);
    }

    clearAuthPendingAction();
  }

  async function onPasswordSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isPasswordSignInEnabled) {
      return;
    }

    dispatchRouteState({
      type: "patch",
      values: {
        authError: null,
        authEmailError: null,
        authPasswordError: null,
        magicLinkMessage: null,
        passwordResetMessage: null,
        isSignInSuccessVisible: false,
        authPendingAction: "password",
      },
    });

    try {
      const result = await authClient.signIn.email({
        email: authEmail,
        password: authPassword,
        rememberMe: true,
      });

      if (result.error) {
        setAuthFailureMessage(result.error.message ?? t`Authentication failed`);
      } else {
        dispatchRouteState({
          type: "patch",
          values: {
            authPassword: "",
          },
        });
        handleSignInSuccess(getAuthResultUser(result.data));
      }
    } catch (error) {
      setAuthFailureMessage(
        error instanceof Error && error.message.endsWith("sign-in is not configured.")
          ? t`Sign-in method is not configured`
          : error instanceof Error
            ? error.message
            : t`Authentication failed`,
      );
    }

    clearAuthPendingAction();
  }

  async function onSocialSignIn(provider: SocialAuthProvider) {
    dispatchRouteState({
      type: "patch",
      values: {
        authError: null,
        authEmailError: null,
        authPasswordError: null,
        magicLinkMessage: null,
        isSignInSuccessVisible: false,
        authPendingAction: provider,
      },
    });

    try {
      const result = await signInWithSocialAuthAccount(provider);

      if (result?.error) {
        setAuthFailureMessage(result.error.message ?? t`Authentication failed`);
      } else {
        const redirectUrl = getAuthRedirectUrl(result.data);

        if (redirectUrl) {
          window.location.replace(redirectUrl);
        } else {
          handleSignInSuccess(getAuthResultUser(result.data));
        }
      }
    } catch (error) {
      setAuthFailureMessage(error instanceof Error ? error.message : t`Authentication failed`);
    }

    clearAuthPendingAction();
  }

  async function onLinkSocialAccount(provider: SocialAuthProvider) {
    clearAuthErrors();
    dispatchRouteState({
      type: "patch",
      values: {
        authPendingAction: provider,
      },
    });

    try {
      const result = await linkSocialAuthAccount(provider);

      if (result.url) {
        window.location.replace(result.url);
      } else {
        const accounts = await fetchLinkedAuthAccounts();
        saveLinkedAccounts(accounts);
        toast.success(t`Sign-in method connected`);
      }
    } catch {
      toast.error(t`Could not connect sign-in method`);
    }

    clearAuthPendingAction();
  }

  async function onRequestPasswordReset(email: string) {
    dispatchRouteState({
      type: "patch",
      values: {
        authError: null,
        authEmailError: null,
        authPasswordError: null,
        passwordResetMessage: null,
        isSignInSuccessVisible: false,
        authPendingAction: "password-reset",
      },
    });

    try {
      await requestPasswordResetEmail(email);
      dispatchRouteState({
        type: "patch",
        values: {
          passwordResetMessage: t`Check your email for the password link`,
        },
      });
      toast.success(t`Password email sent`);
    } catch (error) {
      setAuthFailure(error, t`Could not send password email`);
    }

    clearAuthPendingAction();
  }

  async function onPasswordResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRequestPasswordReset(authEmail);
  }

  async function onSignOut() {
    setIsCloudSyncSwitchOpen(false);
    dispatchRouteState({
      type: "patch",
      values: {
        authPendingAction: "sign-out",
        cloudActionDialog: null,
        isSignInSuccessVisible: false,
        optimisticAuthUser: null,
      },
    });

    try {
      await authClient.signOut();
      clearNativeAuthToken();
      clearCloudSyncState();
      await session.refetch();
      toast.success(t`Signed out`);
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error(t`Could not sign out`);
    }

    clearAuthPendingAction();
  }

  async function onConfirmCloudAction(action: CloudActionDialogType) {
    if (!user) {
      return;
    }

    dispatchRouteState({
      type: "patch",
      values: {
        cloudActionDialog: null,
      },
    });

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

  function openDeleteAccountDialog() {
    dispatchRouteState({ type: "deleteAccountDialogOpened" });
  }

  async function onDeleteAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canDeleteAccount) {
      return;
    }

    dispatchRouteState({
      type: "patch",
      values: {
        deleteAccountError: null,
        isDeleteAccountPending: true,
      },
    });

    try {
      await deleteAuthUserAccount();
      if (userId) {
        clearCachedCloudUserSettings(userId);
        clearCachedCloudAccountState(userId);
      }
      clearCloudSyncState();
      dispatchRouteState({
        type: "patch",
        values: {
          deleteAccountConfirmation: "",
          isDeleteAccountDialogOpen: false,
          optimisticAuthUser: null,
        },
      });
      await session.refetch();
      toast.success(t`Account deleted`);
      void navigate({ to: "/", replace: true });
    } catch (error) {
      dispatchRouteState({
        type: "patch",
        values: {
          deleteAccountError:
            error instanceof Error
              ? getDeleteAccountErrorMessage(error.message)
              : t`Could not delete account`,
        },
      });
    }

    dispatchRouteState({
      type: "patch",
      values: {
        isDeleteAccountPending: false,
      },
    });
  }

  function closeSignInDialog() {
    dispatchRouteState({
      type: "patch",
      values: {
        isSignInDialogOpen: false,
      },
    });
    window.setTimeout(() => {
      closeRouteState(currentLocation, router.history, () => {
        void navigate({ to: "/", replace: true });
      });
    }, DIALOG_EXIT_ANIMATION_MS);
  }

  function onCloudDataActivated(shouldDelay: boolean) {
    if (shouldDelay) {
      return;
    }

    void navigate({ to: "/", replace: true });
  }

  if (!user) {
    return (
      <CloudSyncSignInDialog
        isOpen={isSignInDialogOpen}
        onOpenChange={closeSignInDialog}
        showHeader={!magicLinkMessage && auth !== "success" && !isSignInSuccessVisible}
      >
        <CloudSyncSignInForm
          authState={{
            auth,
            email: authEmail,
            emailError: authEmailError,
            error: authError,
            magicLinkMessage,
            password: authPassword,
            passwordError: authPasswordError,
            passwordResetMessage,
            pendingAction: authPendingAction,
          }}
          mode={signInFormMode}
          onAuthEmailChange={onAuthEmailChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onBackToSignIn={() => {
            dispatchRouteState({
              type: "patch",
              values: {
                authError: null,
                authEmailError: null,
                authPasswordError: null,
                isPasswordResetMode: false,
                magicLinkMessage: null,
                passwordResetMessage: null,
              },
            });
          }}
          onForgotPassword={() => {
            dispatchRouteState({
              type: "patch",
              values: {
                authError: null,
                authEmailError: null,
                authPasswordError: null,
                isPasswordResetMode: true,
                magicLinkMessage: null,
                passwordResetMessage: null,
              },
            });
          }}
          onMagicLinkSubmit={onMagicLinkSubmit}
          onPasswordResetSubmit={onPasswordResetSubmit}
          onPasswordSignInSubmit={onPasswordSignInSubmit}
          onSocialSignIn={(provider) => {
            void onSocialSignIn(provider);
          }}
          onTryAnotherEmail={() => {
            dispatchRouteState({
              type: "patch",
              values: {
                authError: null,
                authEmailError: null,
                authPasswordError: null,
                isPasswordLoginMode: false,
                magicLinkMessage: null,
                passwordResetMessage: null,
              },
            });
          }}
          onUseMagicLink={() => {
            dispatchRouteState({
              type: "patch",
              values: {
                authError: null,
                authEmailError: null,
                authPasswordError: null,
                isPasswordLoginMode: false,
                isPasswordSignInEnabled: true,
                magicLinkMessage: null,
                passwordResetMessage: null,
              },
            });
          }}
          onUsePassword={() => {
            dispatchRouteState({
              type: "patch",
              values: {
                authError: null,
                authEmailError: null,
                authPasswordError: null,
                isPasswordLoginMode: true,
                isPasswordSignInEnabled: false,
                magicLinkMessage: null,
                passwordResetMessage: null,
              },
            });
          }}
          status={{
            isPending: isAuthPending,
            isPasswordSignInEnabled,
            isSignInSuccessVisible,
          }}
        />
      </CloudSyncSignInDialog>
    );
  }

  if (isSignInSuccessVisible) {
    return (
      <>
        <AnimatePresence>
          {!isSignInSuccessAnimationComplete ||
          !isAccountStateResolved ||
          !isCloudSyncSwitchOpen ? (
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
      </>
    );
  }

  return (
    <div className="bg-accent-50 dark:bg-accent-950 fixed inset-0 z-40 flex min-h-full flex-col overflow-y-auto">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

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
          dispatchRouteState({
            type: "patch",
            values: {
              cloudActionDialog: "connect-apple",
            },
          });
        }}
        onConnectGoogle={() => {
          dispatchRouteState({
            type: "patch",
            values: {
              cloudActionDialog: "connect-google",
            },
          });
        }}
        onDeleteAccount={openDeleteAccountDialog}
        onPasswordLink={() => {
          dispatchRouteState({
            type: "patch",
            values: {
              cloudActionDialog: "password-link",
            },
          });
        }}
        onSignOut={() => {
          dispatchRouteState({
            type: "patch",
            values: {
              cloudActionDialog: "sign-out",
            },
          });
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
            dispatchRouteState({
              type: "patch",
              values: {
                cloudActionDialog: null,
              },
            });
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
          dispatchRouteState({
            type: "deleteAccountConfirmationChanged",
            value,
          });
        }}
        onOpenChange={(isOpen) => {
          dispatchRouteState({
            type: "deleteAccountDialogOpenChanged",
            isOpen,
          });
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

          dispatchRouteState({
            type: "patch",
            values: {
              authCallbackDialogError: null,
            },
          });

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
