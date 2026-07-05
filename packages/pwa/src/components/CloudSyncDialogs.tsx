import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { type FormEvent, type ReactNode } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { LazyMotion, domAnimation, m as motion } from "motion/react";
import { getAuthCallbackErrorContent } from "#src/lib/authCallbackErrors.ts";
import { Alert, AlertDescription } from "#src/ui/Alert.tsx";
import { Button } from "#src/ui/Button.tsx";
import { Icon, type IconProps } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { cn } from "#src/ui/utils.js";

export type CloudActionDialogType =
  | "connect-apple"
  | "connect-google"
  | "password-link"
  | "sign-out";

export function CloudSyncSwitchDialog({
  isOpen,
  onSignOut,
  onUseCloudData,
}: {
  isOpen: boolean;
  onSignOut: () => void;
  onUseCloudData: () => void;
}) {
  return (
    <ModalOverlay
      isDismissable={false}
      isKeyboardDismissDisabled
      isOpen={isOpen}
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
            "w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Use trizum cloud on this device?`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-hidden"
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3">
              <span className="bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-50 flex size-10 items-center justify-center rounded-full">
                <Icon icon="lucide.cloud-download" width={20} height={20} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-medium">
                  <Trans>Use trizum cloud on this device?</Trans>
                </h2>
                <p className="text-accent-700 dark:text-accent-50 text-sm">
                  <Trans>
                    This device already has local data. Using trizum cloud here will switch this
                    device to your cloud data. Your local data on this device will stop being used.
                  </Trans>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button className="font-semibold" color="accent" onPress={onUseCloudData}>
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.cloud-download" width={18} height={18} />
                  <Trans>Use cloud data</Trans>
                </span>
              </Button>
              <Button
                className="text-danger-700 dark:text-danger-300 font-semibold"
                color="input-like"
                onPress={onSignOut}
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.log-out" width={18} height={18} />
                  <Trans>Sign out</Trans>
                </span>
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function AuthCallbackErrorDialog({
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
            "w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={content?.title ?? t`Authentication error`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-hidden"
        >
          {content ? (
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-3">
                <span className="bg-danger-50 text-danger-600 dark:bg-danger-950/50 dark:text-danger-300 flex size-10 items-center justify-center rounded-full">
                  <Icon icon="lucide.circle-alert" width={20} height={20} />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-medium">{content.title}</h2>
                  <p className="text-accent-700 dark:text-accent-50 text-sm">
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

export function CloudSyncSignInDialog({
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
            "h-full w-full outline-hidden sm:h-auto sm:max-w-[420px]",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Sign in`}
          className="sm:border-accent-200 dark:bg-accent-950 dark:sm:border-accent-800 relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white shadow-2xl outline-hidden sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg sm:border"
        >
          <IconButton
            aria-label={t`Back to settings`}
            className="right-safe-offset-2 top-safe-offset-2 absolute sm:top-2 sm:right-2"
            icon="lucide.x"
            onPress={onOpenChange}
          />
          <div className="pb-safe-offset-5 pt-safe-offset-14 px-safe-or-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto sm:p-6 sm:pt-14">
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

export function AuthErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <Icon icon="lucide.circle-alert" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function AuthButtonIcon({
  icon,
  isPending,
}: {
  icon: IconProps["icon"];
  isPending: boolean;
}) {
  return (
    <Icon
      className={cn(isPending && "animate-spin")}
      icon={isPending ? "lucide.loader-circle" : icon}
      width={18}
      height={18}
    />
  );
}

export function CloudAuthLoadingState() {
  return (
    <LazyMotion features={domAnimation}>
      <output
        aria-label={t`Finishing sign in`}
        className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center"
      >
        <motion.span
          animate={{ rotate: 360 }}
          className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50 flex size-12 items-center justify-center rounded-full"
          transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
        >
          <Icon icon="lucide.loader-circle" width={24} height={24} />
        </motion.span>
        <p className="text-accent-700 dark:text-accent-50 text-sm font-medium">
          <Trans>Finishing sign in</Trans>
        </p>
      </output>
    </LazyMotion>
  );
}

export function MagicLinkSentState({
  email,
  message,
  onTryAgain,
}: {
  email: string;
  message: string;
  onTryAgain: () => void;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <motion.div
        className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <motion.span
          className="bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-200 flex size-16 items-center justify-center rounded-full"
          initial={{ scale: 0.72 }}
          animate={{ scale: [0.72, 1.08, 1] }}
          transition={{ delay: 0.04, duration: 0.38, ease: "easeOut" }}
        >
          <Icon icon="lucide.mail-check" width={28} height={28} />
        </motion.span>
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-medium">{message}</h3>
          <p className="text-accent-700 dark:text-accent-50 text-sm">
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
    </LazyMotion>
  );
}

export function SignInSuccessOverlay({ exitAnimationMs }: { exitAnimationMs: number }) {
  return (
    <LazyMotion features={domAnimation}>
      <motion.div
        className="py-safe-offset-6 px-safe-or-4 dark:bg-accent-950/90 fixed inset-0 z-[60] flex items-center justify-center bg-white/90 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: exitAnimationMs / 1000, ease: "easeOut" }}
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
    </LazyMotion>
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
        className="bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-200 flex size-16 items-center justify-center rounded-full"
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

export function CloudActionConfirmationDialog({
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
            "w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={config?.title ?? t`Confirm action`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-hidden"
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
                  <p className="text-accent-700 dark:text-accent-50 text-sm">
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

export function DeleteAccountDialog({
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
            "w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Delete account`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-hidden"
        >
          <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">
                <Trans>Delete account?</Trans>
              </h2>
              <p className="text-accent-700 dark:text-accent-50 text-sm">
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
