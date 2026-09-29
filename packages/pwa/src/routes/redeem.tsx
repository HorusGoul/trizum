import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PremiumCodeRedemption } from "#src/components/PremiumCodeRedemption.tsx";
import { BackButton } from "#src/components/BackButton.tsx";
import { useOnlineStatus } from "#src/hooks/useOnlineStatus.ts";
import { authClient, useAppSession } from "#src/lib/auth-client.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import {
  getStoreRedemptionUrl,
  parseRedemptionSearch,
  type PremiumRedemptionRequest,
} from "#src/lib/premium/premiumRedemption.ts";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { openPremiumCodeRedemption } from "#src/lib/premium/revenueCatClient.ts";
import { checkRedemptionConnection } from "#src/lib/premium/redemptionConnection.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { Alert, AlertDescription } from "#src/ui/Alert.tsx";
import { Button } from "#src/ui/Button.tsx";

const CloudSyncSettingsView = lazy(() =>
  import("#src/components/CloudSyncSettingsView.tsx").then((module) => ({
    default: module.CloudSyncSettingsView,
  })),
);

type PendingAction = { kind: "redeem"; request: PremiumRedemptionRequest } | { kind: "premium" };

export const Route = createFileRoute("/redeem")({
  component: RedeemCode,
  validateSearch: parseRedemptionSearch,
});

function RedeemCode() {
  const { code, store } = Route.useSearch();
  return <RedemptionPage key={`${code}:${store ?? ""}`} initialCode={code} resumeStore={store} />;
}

function RedemptionPage({
  initialCode,
  resumeStore,
}: {
  initialCode: string;
  resumeStore?: "ios" | "android";
}) {
  const [code, setCode] = useState(initialCode);
  const [isSignInOpen, setSignInOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(() =>
    resumeStore ? { kind: "redeem", request: { platform: resumeStore, code: initialCode } } : null,
  );
  const requestedAction = useRef(pendingAction);
  const resumed = useRef(false);
  const completedAction = useRef<PendingAction | null>(null);
  const [readyAction, setReadyAction] = useState<{ action: PendingAction; userId: string } | null>(
    null,
  );
  const [authError, setAuthError] = useState(false);
  const [isChecking, startChecking] = useTransition();
  const navigate = useNavigate();
  const session = useAppSession();
  const isOnline = useOnlineStatus();
  const user = session.data?.user;
  const email = user?.email;
  const premium = usePremium();

  function showPremium() {
    // Paywall promises resolve on dismissal; do not hold a React action transition open.
    void premium
      .presentPaywall()
      .catch(() => toast.error(t`Could not open Premium. Please try again.`));
  }

  function completeAction(action: PendingAction, userId: string) {
    setReadyAction({ action, userId });
    setPendingAction(null);
  }

  async function authenticate(action: PendingAction) {
    try {
      const result = await authClient.getSession({ query: { disableCookieCache: true } });
      if (requestedAction.current !== action) return;
      if (result.error) {
        setAuthError(true);
        return;
      }
      if (result.data?.user) completeAction(action, result.data.user.id);
      else setSignInOpen(true);
    } catch {
      if (requestedAction.current === action) setAuthError(true);
    }
  }

  function requestAction(action: PendingAction) {
    requestedAction.current = action;
    setPendingAction(action);
    setAuthError(false);
    startChecking(async () => {
      await authenticate(action);
    });
  }

  const resumeAuthentication = useEffectEvent(() => {
    if (pendingAction) void authenticate(pendingAction);
  });
  useEffect(() => {
    if (!resumeStore || resumed.current) return;
    resumed.current = true;
    resumeAuthentication();
  }, [resumeStore]);

  const launchAction = useEffectEvent(async (action: PendingAction, userId: string) => {
    try {
      if (resumeStore) await navigate({ to: "/redeem", search: { code }, replace: true });
      if (action.kind === "premium") await premium.presentPaywall();
      else if (checkRedemptionConnection()) {
        if (getRevenueCatPlatform()) await openPremiumCodeRedemption(userId, action.request.code);
        else
          window.location.assign(
            getStoreRedemptionUrl(action.request.platform, action.request.code),
          );
      }
    } catch {
      toast.error(
        action.kind === "premium"
          ? t`Could not open Premium. Please try again.`
          : t`Code redemption could not be opened. Please try again.`,
      );
    }
  });
  useEffect(() => {
    if (!readyAction || completedAction.current === readyAction.action) return;
    // PremiumProvider must have observed the authenticated session before opening its dialog.
    if (readyAction.action.kind === "premium" && user?.id !== readyAction.userId) return;
    completedAction.current = readyAction.action;
    void launchAction(readyAction.action, readyAction.userId).then(() => setReadyAction(null));
  }, [readyAction, user?.id]);

  function requestSignIn(request: PremiumRedemptionRequest) {
    requestAction({ kind: "redeem", request });
  }

  function openPremium() {
    if (user) showPremium();
    else requestAction({ kind: "premium" });
  }

  function closeSignIn() {
    requestedAction.current = null;
    setSignInOpen(false);
    setPendingAction(null);
    setAuthError(false);
    if (resumeStore) void navigate({ to: "/redeem", search: { code }, replace: true });
  }

  const returnSearch = new URLSearchParams({ code });
  if (pendingAction?.kind === "redeem") returnSearch.set("store", pendingAction.request.platform);
  const showAccountStatus = !isOnline || Boolean(user) || Boolean(pendingAction);

  return (
    <div className="pb-safe flex min-h-full flex-col">
      <meta name="robots" content="noindex, nofollow" />
      <header className="mt-safe mx-auto flex h-16 w-full max-w-[480px] items-center gap-2 px-2">
        <BackButton fallbackOptions={{ to: "/settings" }} />
        <h1 className="text-lg font-bold tracking-tight">
          <Trans>Redeem code</Trans>
        </h1>
      </header>
      <main className="mx-auto w-full max-w-[480px] px-4 pt-2 pb-8">
        {showAccountStatus ? (
          <div className="text-accent-800 dark:text-accent-200 mb-4 flex min-h-10 items-center gap-2 text-sm">
            {!isOnline ? (
              <Alert variant="warning">
                <Icon icon="lucide.wifi-off" />
                <AlertDescription>
                  <Trans>You seem to be offline.</Trans>
                </AlertDescription>
              </Alert>
            ) : pendingAction && !authError && !isSignInOpen ? (
              <output>
                <Trans>Loading sign-in…</Trans>
              </output>
            ) : pendingAction && authError ? (
              <Alert variant="warning">
                <Icon icon="lucide.triangle-alert" />
                <AlertDescription>
                  <p>
                    <Trans>
                      Sign-in is unavailable, so we can’t link your offer to trizum yet.
                    </Trans>
                  </p>
                  <Button
                    className="h-auto w-auto rounded-sm py-1 font-semibold underline underline-offset-4"
                    onPress={() => {
                      if (pendingAction)
                        requestAction(
                          pendingAction.kind === "redeem"
                            ? { kind: "redeem", request: { ...pendingAction.request, code } }
                            : pendingAction,
                        );
                    }}
                  >
                    <Trans>Try again</Trans>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : user ? (
              <output className="flex min-w-0 items-center gap-2">
                <Icon icon="lucide.check" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  <Trans>Signed in as {email}</Trans>
                </span>
              </output>
            ) : null}
          </div>
        ) : null}
        <PremiumCodeRedemption
          userId={user?.id ?? null}
          initialCode={initialCode}
          onCodeChange={setCode}
          isDisabled={isChecking}
          onSignIn={requestSignIn}
          onOpenPremium={openPremium}
        />
        {premium.isPremium ? (
          <output className="text-accent-900 dark:text-accent-100 mt-4 flex items-center gap-2 text-sm font-medium">
            <Icon icon="lucide.check" className="size-4" />
            <Trans>Premium is active.</Trans>
          </output>
        ) : null}
      </main>
      {isSignInOpen ? (
        <Suspense
          fallback={
            <output className="px-4">
              <Trans>Loading sign-in…</Trans>
            </output>
          }
        >
          <CloudSyncSettingsView
            search={{ returnTo: `/redeem?${returnSearch}` }}
            onClose={closeSignIn}
            onSignedIn={(userId) => {
              if (pendingAction) completeAction(pendingAction, userId);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
