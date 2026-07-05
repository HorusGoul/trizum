import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { type FormEvent } from "react";
import type { SocialAuthProvider } from "#src/lib/auth-client.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { AppTextField } from "#src/ui/fields/TextField.js";
import {
  AuthButtonIcon,
  AuthErrorAlert,
  CloudAuthLoadingState,
  MagicLinkSentState,
} from "./CloudSyncDialogs.tsx";

const AUTH_SECONDARY_BUTTON_CLASS_NAME =
  "h-9 text-sm font-medium text-accent-700 dark:text-accent-50";

export type AuthPendingAction =
  | "apple"
  | "google"
  | "magic-link"
  | "password"
  | "password-reset"
  | "sign-out";

interface CloudSyncSignInFormAuthState {
  auth?: "success";
  email: string;
  emailError: string | null;
  error: string | null;
  magicLinkMessage: string | null;
  password: string;
  passwordError: string | null;
  passwordResetMessage: string | null;
  pendingAction: AuthPendingAction | null;
}

interface CloudSyncSignInFormStatus {
  isPending: boolean;
  isPasswordSignInEnabled: boolean;
  isSignInSuccessVisible: boolean;
}

type CloudSyncSignInFormMode = "magic-link" | "password" | "password-reset";

export function CloudSyncSignInForm({
  authState,
  mode,
  onAuthEmailChange,
  onAuthPasswordChange,
  onBackToSignIn,
  onForgotPassword,
  onMagicLinkSubmit,
  onPasswordResetSubmit,
  onPasswordSignInSubmit,
  onSocialSignIn,
  onTryAnotherEmail,
  onUseMagicLink,
  onUsePassword,
  status,
}: {
  authState: CloudSyncSignInFormAuthState;
  mode: CloudSyncSignInFormMode;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onBackToSignIn: () => void;
  onForgotPassword: () => void;
  onMagicLinkSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPasswordResetSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPasswordSignInSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSocialSignIn: (provider: SocialAuthProvider) => void;
  onTryAnotherEmail: () => void;
  onUseMagicLink: () => void;
  onUsePassword: () => void;
  status: CloudSyncSignInFormStatus;
}) {
  if (authState.auth === "success" || status.isSignInSuccessVisible) {
    return <CloudAuthLoadingState />;
  }

  if (mode === "password-reset") {
    return (
      <form className="flex flex-col gap-4" onSubmit={onPasswordResetSubmit}>
        {authState.error ? <AuthErrorAlert message={authState.error} /> : null}
        <AppTextField
          errorMessage={authState.emailError ?? undefined}
          isDisabled={status.isPending}
          isInvalid={Boolean(authState.emailError)}
          isRequired
          label={t`Email`}
          onChange={onAuthEmailChange}
          type="email"
          value={authState.email}
        />
        {authState.passwordResetMessage ? (
          <p className="text-accent-700 dark:text-accent-50 text-sm">
            {authState.passwordResetMessage}
          </p>
        ) : null}
        <Button color="accent" isDisabled={status.isPending} type="submit">
          <span className="flex items-center gap-2">
            <AuthButtonIcon
              icon="lucide.mail"
              isPending={authState.pendingAction === "password-reset"}
            />
            <Trans>Send password link</Trans>
          </span>
        </Button>
        <Button
          color="transparent"
          isDisabled={status.isPending}
          onPress={onBackToSignIn}
          type="button"
        >
          <Trans>Back to sign in</Trans>
        </Button>
      </form>
    );
  }

  if (authState.magicLinkMessage) {
    return (
      <MagicLinkSentState
        email={authState.email}
        message={authState.magicLinkMessage}
        onTryAgain={onTryAnotherEmail}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          color="input-like"
          isDisabled={status.isPending}
          onPress={() => {
            onSocialSignIn("apple");
          }}
        >
          <span className="flex items-center gap-2">
            <AuthButtonIcon icon="brand.apple" isPending={authState.pendingAction === "apple"} />
            <Trans>Continue with Apple</Trans>
          </span>
        </Button>
        <Button
          color="input-like"
          isDisabled={status.isPending}
          onPress={() => {
            onSocialSignIn("google");
          }}
        >
          <span className="flex items-center gap-2">
            <AuthButtonIcon icon="brand.google" isPending={authState.pendingAction === "google"} />
            <Trans>Continue with Google</Trans>
          </span>
        </Button>
      </div>

      <div className="text-accent-600 dark:text-accent-300 flex items-center gap-3 text-xs font-medium uppercase">
        <span className="bg-accent-200 dark:bg-accent-700 h-px flex-1" />
        <Trans>or use email</Trans>
        <span className="bg-accent-200 dark:bg-accent-700 h-px flex-1" />
      </div>

      {mode === "password" ? (
        <PasswordSignInForm
          authEmail={authState.email}
          authEmailError={authState.emailError}
          authError={authState.error}
          authPassword={authState.password}
          authPasswordError={authState.passwordError}
          authPendingAction={authState.pendingAction}
          isAuthPending={status.isPending}
          isPasswordSignInEnabled={status.isPasswordSignInEnabled}
          onAuthEmailChange={onAuthEmailChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onForgotPassword={onForgotPassword}
          onSubmit={onPasswordSignInSubmit}
          onUseMagicLink={onUseMagicLink}
        />
      ) : (
        <MagicLinkSignInForm
          authEmail={authState.email}
          authEmailError={authState.emailError}
          authError={authState.error}
          authPendingAction={authState.pendingAction}
          isAuthPending={status.isPending}
          onAuthEmailChange={onAuthEmailChange}
          onSubmit={onMagicLinkSubmit}
          onUsePassword={onUsePassword}
        />
      )}
    </>
  );
}

function PasswordSignInForm({
  authEmail,
  authEmailError,
  authError,
  authPassword,
  authPasswordError,
  authPendingAction,
  isAuthPending,
  isPasswordSignInEnabled,
  onAuthEmailChange,
  onAuthPasswordChange,
  onForgotPassword,
  onSubmit,
  onUseMagicLink,
}: {
  authEmail: string;
  authEmailError: string | null;
  authError: string | null;
  authPassword: string;
  authPasswordError: string | null;
  authPendingAction: AuthPendingAction | null;
  isAuthPending: boolean;
  isPasswordSignInEnabled: boolean;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onForgotPassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUseMagicLink: () => void;
}) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
          <AuthButtonIcon icon="lucide.log-in" isPending={authPendingAction === "password"} />
          <Trans>Sign in with password</Trans>
        </span>
      </Button>
      <Button color="input-like" isDisabled={isAuthPending} onPress={onUseMagicLink} type="button">
        <span className="flex items-center gap-2">
          <Icon icon="lucide.mail" width={18} height={18} />
          <Trans>Sign in with magic link</Trans>
        </span>
      </Button>
      <Button
        className={AUTH_SECONDARY_BUTTON_CLASS_NAME}
        color="transparent"
        isDisabled={isAuthPending}
        onPress={onForgotPassword}
        type="button"
      >
        <Trans>Forgot password?</Trans>
      </Button>
    </form>
  );
}

function MagicLinkSignInForm({
  authEmail,
  authEmailError,
  authError,
  authPendingAction,
  isAuthPending,
  onAuthEmailChange,
  onSubmit,
  onUsePassword,
}: {
  authEmail: string;
  authEmailError: string | null;
  authError: string | null;
  authPendingAction: AuthPendingAction | null;
  isAuthPending: boolean;
  onAuthEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUsePassword: () => void;
}) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
          <AuthButtonIcon icon="lucide.mail" isPending={authPendingAction === "magic-link"} />
          <Trans>Email me a sign-in link</Trans>
        </span>
      </Button>
      <Button color="input-like" isDisabled={isAuthPending} onPress={onUsePassword} type="button">
        <span className="flex items-center gap-2">
          <Icon icon="lucide.key-round" width={18} height={18} />
          <Trans>Sign in with password</Trans>
        </span>
      </Button>
    </form>
  );
}
