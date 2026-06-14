import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import {
  authClient,
  fetchLinkedAuthAccounts,
  linkSocialAuthAccount,
  requestMagicLinkEmail,
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
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
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

interface CloudSyncSearchParams {
  auth?: "success";
  error?: string;
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
  const [isPasswordLoginMode, setIsPasswordLoginMode] = useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [isSignInSuccessVisible, setIsSignInSuccessVisible] = useState(auth === "success");
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAuthAccount[]>([]);
  const [cloudSettings, setCloudSettings] = useState<CloudUserSettings | null>(null);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isCloudPending, setIsCloudPending] = useState(false);
  const [isCloudSyncSwitchOpen, setIsCloudSyncSwitchOpen] = useState(false);
  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const linkedProviderLabels = linkedAccounts
    .map((account) => getProviderLabel(account.providerId))
    .join(", ");
  const hasPasswordAccount = linkedProviderIds.has("credential");
  const cloudUpdatedAt = cloudSettings ? new Date(cloudSettings.updatedAt).toLocaleString() : null;
  const isCurrentDocumentSynced = cloudSettings?.partyListDocumentId === partyList.id;

  useEffect(() => {
    if (!userId) {
      setLinkedAccounts([]);
      setCloudSettings(null);
      return;
    }

    let isCancelled = false;

    void loadAccountState().catch(() => {
      if (!isCancelled) {
        toast.error(t`Could not load cloud sync state`);
      }
    });

    return () => {
      isCancelled = true;
    };

    async function loadAccountState() {
      setIsCloudPending(true);

      try {
        const [accounts, { settings }] = await Promise.all([
          fetchLinkedAuthAccounts(),
          fetchCloudUserSettings(),
        ]);

        if (!isCancelled) {
          setLinkedAccounts(accounts);
          setCloudSettings(settings);
        }
      } finally {
        if (!isCancelled) {
          setIsCloudPending(false);
        }
      }
    }
  }, [userId]);

  useEffect(() => {
    if (auth === "success") {
      setIsSignInSuccessVisible(true);
    }
  }, [auth]);

  useEffect(() => {
    if (auth !== "success" || !userId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSignInSuccessVisible(false);
      void navigate({ to: "/settings/cloud-sync", replace: true });
    }, SIGN_IN_SUCCESS_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [auth, navigate, userId]);

  useEffect(() => {
    if (userId || auth === "success") {
      return;
    }

    setIsSignInSuccessVisible(false);
  }, [auth, userId]);

  useEffect(() => {
    if (!authCallbackError || userId) {
      return;
    }

    setAuthError(getAuthCallbackErrorMessage(authCallbackError));
  }, [authCallbackError, userId]);

  async function showSignInSuccess() {
    setIsSignInSuccessVisible(true);
    await new Promise((resolve) => window.setTimeout(resolve, SIGN_IN_SUCCESS_ANIMATION_MS));
  }

  async function onMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setMagicLinkMessage(null);
    setPasswordResetMessage(null);
    setIsSignInSuccessVisible(false);
    setIsAuthPending(true);

    try {
      await requestMagicLinkEmail({
        email: authEmail,
        name: partyList.username.trim() || authEmail,
      });
      setMagicLinkMessage(t`Check your email for the sign-in link`);
      toast.success(t`Sign-in link sent`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t`Could not send sign-in link`);
    } finally {
      setIsAuthPending(false);
    }
  }

  async function onPasswordSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setMagicLinkMessage(null);
    setPasswordResetMessage(null);
    setIsSignInSuccessVisible(false);
    setIsAuthPending(true);

    try {
      const result = await authClient.signIn.email({
        email: authEmail,
        password: authPassword,
        rememberMe: true,
      });

      if (result.error) {
        setAuthError(result.error.message ?? t`Authentication failed`);
        return;
      }

      setAuthPassword("");
      toast.success(t`Signed in`);
      await Promise.all([showSignInSuccess(), session.refetch()]);
      setIsSignInSuccessVisible(false);
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
    setMagicLinkMessage(null);
    setIsSignInSuccessVisible(false);
    setIsAuthPending(true);

    try {
      const result = await signInWithSocialAuthAccount(provider);

      if (result?.error) {
        setAuthError(result.error.message ?? t`Authentication failed`);
        return;
      }

      toast.success(t`Signed in`);
      await Promise.all([showSignInSuccess(), session.refetch()]);
      setIsSignInSuccessVisible(false);
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
    setIsSignInSuccessVisible(false);
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
    setIsSignInSuccessVisible(false);
    setIsAuthPending(true);

    try {
      await authClient.signOut();
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
    if (cloudSettings) {
      toast.message(
        isCurrentDocumentSynced
          ? t`This device is already using cloud sync`
          : t`Cloud sync is already set up for this account`,
      );
      return;
    }

    setIsCloudPending(true);

    try {
      const { settings } = await saveCloudUserSettings(getCloudUserSettingsInput(partyList));
      setCloudSettings(settings);
      toast.success(t`Cloud sync updated`);
    } catch {
      toast.error(t`Could not update cloud sync`);
    } finally {
      setIsCloudPending(false);
    }
  }

  function activateCloudSyncOnDevice() {
    if (!cloudSettings) {
      toast.message(t`Cloud sync is not set up yet`);
      return;
    }

    if (!isValidDocumentId(cloudSettings.partyListDocumentId)) {
      toast.error(t`Cloud sync data is invalid`);
      return;
    }

    if (cloudSettings.partyListDocumentId === partyList.id) {
      toast.message(t`This device is already using cloud sync`);
      return;
    }

    localStorage.setItem("partyListId", cloudSettings.partyListDocumentId);
    setIsCloudSyncSwitchOpen(false);
    toast.success(t`Cloud sync enabled on this device`);
    void navigate({ to: "/", replace: true });
  }

  function onUseCloudSync() {
    if (!cloudSettings) {
      toast.message(t`Cloud sync is not set up yet`);
      return;
    }

    if (!isValidDocumentId(cloudSettings.partyListDocumentId)) {
      toast.error(t`Cloud sync data is invalid`);
      return;
    }

    if (cloudSettings.partyListDocumentId === partyList.id) {
      toast.message(t`This device is already using cloud sync`);
      return;
    }

    if (hasLocalPartyListData(partyList)) {
      setIsCloudSyncSwitchOpen(true);
      return;
    }

    activateCloudSyncOnDevice();
  }

  function closeSignInDialog() {
    void navigate({ to: "/settings", replace: true });
  }

  if (!user) {
    return (
      <div className="relative min-h-full">
        <div aria-hidden="true" className="min-h-full blur-[2px]">
          <Settings />
        </div>

        <CloudSyncSignInDialog isOpen onOpenChange={closeSignInDialog}>
          {isSignInSuccessVisible ? (
            <SignInSuccessAnimation />
          ) : isPasswordResetMode ? (
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
                  setMagicLinkMessage(null);
                  setPasswordResetMessage(null);
                }}
                type="button"
              >
                <Trans>Back to sign in</Trans>
              </Button>
            </form>
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
                    <Icon icon="brand.apple" width={18} height={18} />
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
                    <Icon icon="brand.google" width={18} height={18} />
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
                  <AppTextField
                    isDisabled={isAuthPending}
                    label={t`Email`}
                    onChange={setAuthEmail}
                    type="email"
                    value={authEmail}
                  />
                  <AppTextField
                    description={t`Password sign in only works after you add a password to your account.`}
                    isDisabled={isAuthPending}
                    label={t`Password`}
                    minLength={8}
                    onChange={setAuthPassword}
                    type="password"
                    value={authPassword}
                  />
                  <Button
                    color="transparent"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordLoginMode(false);
                      setAuthError(null);
                      setMagicLinkMessage(null);
                      setPasswordResetMessage(null);
                    }}
                    type="button"
                  >
                    <Trans>Use magic link instead</Trans>
                  </Button>
                  {authError ? <p className="text-sm text-danger-500">{authError}</p> : null}
                  <Button color="input-like" isDisabled={isAuthPending} type="submit">
                    <span className="flex items-center gap-2">
                      <Icon icon="lucide.log-in" width={18} height={18} />
                      <Trans>Sign in with password</Trans>
                    </span>
                  </Button>
                  <Button
                    color="transparent"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordResetMode(true);
                      setAuthError(null);
                      setMagicLinkMessage(null);
                      setPasswordResetMessage(null);
                    }}
                    type="button"
                  >
                    <Trans>Forgot password?</Trans>
                  </Button>
                </form>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={onMagicLinkSubmit}>
                  <AppTextField
                    isDisabled={isAuthPending}
                    label={t`Email`}
                    onChange={setAuthEmail}
                    type="email"
                    value={authEmail}
                  />
                  {authError ? <p className="text-sm text-danger-500">{authError}</p> : null}
                  {magicLinkMessage ? (
                    <p className="text-sm text-accent-700 dark:text-accent-50">
                      {magicLinkMessage}
                    </p>
                  ) : null}
                  <Button color="accent" isDisabled={isAuthPending} type="submit">
                    <span className="flex items-center gap-2">
                      <Icon icon="lucide.mail" width={18} height={18} />
                      <Trans>Email me a sign-in link</Trans>
                    </span>
                  </Button>
                  <Button
                    color="transparent"
                    isDisabled={isAuthPending}
                    onPress={() => {
                      setIsPasswordLoginMode(true);
                      setAuthError(null);
                      setMagicLinkMessage(null);
                      setPasswordResetMessage(null);
                    }}
                    type="button"
                  >
                    <Trans>Use password instead</Trans>
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
          <Trans>Cloud sync</Trans>
        </h1>
      </div>

      <div className="container mt-4 flex flex-col gap-6 px-4 pb-8 pb-safe">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{user.name || user.email}</span>
            <span className="text-accent-700 dark:text-accent-50">{user.email}</span>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-medium">
              <Trans>Sign-in methods</Trans>
            </h2>

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
                  <Icon icon="brand.google" width={18} height={18} />
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
                  <Icon icon="brand.apple" width={18} height={18} />
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
        </section>

        <section className="flex flex-col gap-4 border-t border-accent-200 pt-6 dark:border-accent-700">
          <h2 className="text-base font-medium">
            <Trans>Cloud sync</Trans>
          </h2>

          <div className="flex flex-col gap-2 text-sm text-accent-700 dark:text-accent-50">
            {!cloudSettings ? (
              <p>
                <Trans>Cloud sync is not set up yet.</Trans>
              </p>
            ) : isCurrentDocumentSynced ? (
              <p>
                <Trans>This device is using cloud sync.</Trans>
              </p>
            ) : (
              <>
                <p>
                  <Trans>Cloud sync is already set up for this account.</Trans>
                </p>
                <p>
                  <Trans>Use it on this device to continue with your cloud data.</Trans>
                </p>
              </>
            )}
            {cloudUpdatedAt ? (
              <p>
                <Trans>Last updated {cloudUpdatedAt}</Trans>
              </p>
            ) : null}
          </div>

          {!cloudSettings ? (
            <Button color="accent" isDisabled={isCloudPending} onPress={onSaveCloudSettings}>
              <span className="flex items-center gap-2">
                <Icon icon="lucide.cloud-upload" width={18} height={18} />
                <Trans>Set up cloud sync</Trans>
              </span>
            </Button>
          ) : !isCurrentDocumentSynced ? (
            <Button color="accent" isDisabled={isCloudPending} onPress={onUseCloudSync}>
              <span className="flex items-center gap-2">
                <Icon icon="lucide.cloud-download" width={18} height={18} />
                <Trans>Use cloud sync on this device</Trans>
              </span>
            </Button>
          ) : null}

          <Button color="transparent" isDisabled={isAuthPending} onPress={onSignOut}>
            <span className="flex items-center gap-2">
              <Icon icon="lucide.log-out" width={18} height={18} />
              <Trans>Sign out</Trans>
            </span>
          </Button>
        </section>
      </div>

      {isSignInSuccessVisible ? <SignInSuccessModal /> : null}

      <ModalSheet isOpen={isCloudSyncSwitchOpen} onOpenChange={setIsCloudSyncSwitchOpen}>
        <ModalSheetHeader>
          <ModalSheetSection className="flex flex-col gap-2">
            <ModalSheetTitle>
              <Trans>Use cloud sync on this device?</Trans>
            </ModalSheetTitle>
            <ModalSheetDescription>
              <Trans>
                This device already has local trizum data. Using cloud sync here will switch this
                device to your cloud data, and the local list on this device will stop being used.
              </Trans>
            </ModalSheetDescription>
          </ModalSheetSection>
        </ModalSheetHeader>
        <ModalSheetContent>
          <ModalSheetActions>
            <ModalSheetAction icon="lucide.cloud-download" onPress={activateCloudSyncOnDevice}>
              <Trans>Use cloud data</Trans>
            </ModalSheetAction>
            <ModalSheetAction
              icon="lucide.x"
              onPress={() => {
                setIsCloudSyncSwitchOpen(false);
              }}
            >
              <Trans>Keep local data</Trans>
            </ModalSheetAction>
          </ModalSheetActions>
        </ModalSheetContent>
      </ModalSheet>
    </div>
  );
}

function CloudSyncSignInDialog({
  children,
  isOpen,
  onOpenChange,
}: {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: () => void;
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
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/35 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
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
          aria-label={t`Sign in`}
          className="relative max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border border-accent-200 bg-white shadow-2xl outline-none dark:border-accent-800 dark:bg-accent-950"
        >
          <IconButton
            aria-label={t`Back to settings`}
            className="absolute right-2 top-2"
            icon="lucide.x"
            onPress={onOpenChange}
          />
          <div className="flex flex-col gap-5 overflow-y-auto p-5 pt-14 sm:p-6 sm:pt-14">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-lg font-medium">
                <Trans>Cloud sync</Trans>
              </h2>
            </div>

            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function SignInSuccessModal() {
  return (
    <ModalOverlay
      isOpen
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/35 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
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
          aria-label={t`Signed in`}
          className="rounded-lg border border-accent-200 bg-white shadow-2xl outline-none dark:border-accent-800 dark:bg-accent-950"
        >
          <SignInSuccessAnimation />
        </Dialog>
      </Modal>
    </ModalOverlay>
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

function getAuthCallbackErrorMessage(error: string) {
  switch (error) {
    case "INVALID_TOKEN":
      return t`Sign-in link is invalid or expired`;
    default:
      return t`Authentication failed`;
  }
}
