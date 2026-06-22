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

export function CloudSyncSignInForm({
  auth,
  authEmail,
  authEmailError,
  authError,
  authPassword,
  authPasswordError,
  authPendingAction,
  isAuthPending,
  isPasswordLoginMode,
  isPasswordResetMode,
  isPasswordSignInEnabled,
  isSignInSuccessVisible,
  magicLinkMessage,
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
  passwordResetMessage,
}: {
  auth?: "success";
  authEmail: string;
  authEmailError: string | null;
  authError: string | null;
  authPassword: string;
  authPasswordError: string | null;
  authPendingAction: AuthPendingAction | null;
  isAuthPending: boolean;
  isPasswordLoginMode: boolean;
  isPasswordResetMode: boolean;
  isPasswordSignInEnabled: boolean;
  isSignInSuccessVisible: boolean;
  magicLinkMessage: string | null;
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
  passwordResetMessage: string | null;
}) {
  if (auth === "success" || isSignInSuccessVisible) {
    return <CloudAuthLoadingState />;
  }

  if (isPasswordResetMode) {
    return (
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
          <p className="text-sm text-accent-700 dark:text-accent-50">{passwordResetMessage}</p>
        ) : null}
        <Button color="accent" isDisabled={isAuthPending} type="submit">
          <span className="flex items-center gap-2">
            <AuthButtonIcon icon="lucide.mail" isPending={authPendingAction === "password-reset"} />
            <Trans>Send password link</Trans>
          </span>
        </Button>
        <Button
          color="transparent"
          isDisabled={isAuthPending}
          onPress={onBackToSignIn}
          type="button"
        >
          <Trans>Back to sign in</Trans>
        </Button>
      </form>
    );
  }

  if (magicLinkMessage) {
    return (
      <MagicLinkSentState
        email={authEmail}
        message={magicLinkMessage}
        onTryAgain={onTryAnotherEmail}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          color="input-like"
          isDisabled={isAuthPending}
          onPress={() => {
            onSocialSignIn("apple");
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
            onSocialSignIn("google");
          }}
        >
          <span className="flex items-center gap-2">
            <AuthButtonIcon icon="brand.google" isPending={authPendingAction === "google"} />
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
        <PasswordSignInForm
          authEmail={authEmail}
          authEmailError={authEmailError}
          authError={authError}
          authPassword={authPassword}
          authPasswordError={authPasswordError}
          authPendingAction={authPendingAction}
          isAuthPending={isAuthPending}
          isPasswordSignInEnabled={isPasswordSignInEnabled}
          onAuthEmailChange={onAuthEmailChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onForgotPassword={onForgotPassword}
          onSubmit={onPasswordSignInSubmit}
          onUseMagicLink={onUseMagicLink}
        />
      ) : (
        <MagicLinkSignInForm
          authEmail={authEmail}
          authEmailError={authEmailError}
          authError={authError}
          authPendingAction={authPendingAction}
          isAuthPending={isAuthPending}
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
