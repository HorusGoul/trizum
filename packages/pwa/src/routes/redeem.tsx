import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { PremiumCodeRedemption } from "#src/components/PremiumCodeRedemption.tsx";
import { BackButton } from "#src/components/BackButton.tsx";
import { useOnlineStatus } from "#src/hooks/useOnlineStatus.ts";
import { useAppSession } from "#src/lib/auth-client.ts";
import { getAuthSessionStatus } from "#src/lib/authSessionStatus.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import { parseRedemptionSearch } from "#src/lib/premium/premiumRedemption.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { Button } from "#src/ui/Button.tsx";

const CloudSyncSettingsView = lazy(() =>
  import("#src/components/CloudSyncSettingsView.tsx").then((module) => ({
    default: module.CloudSyncSettingsView,
  })),
);

export const Route = createFileRoute("/redeem")({
  component: RedeemCode,
  validateSearch: parseRedemptionSearch,
});

function RedeemCode() {
  const { code } = Route.useSearch();
  return <RedemptionPage key={code} initialCode={code} />;
}

function RedemptionPage({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [isSignInOpen, setSignInOpen] = useState(false);
  const openPremiumAfterSignIn = useRef(false);
  const session = useAppSession();
  const isOnline = useOnlineStatus();
  const sessionStatus = getAuthSessionStatus(session);
  const user = session.data?.user;
  const email = user?.email;
  const premium = usePremium();
  const isAccountUnavailable = sessionStatus === "pending" || sessionStatus === "unavailable";

  function openPremium() {
    if (!user) {
      openPremiumAfterSignIn.current = true;
      setSignInOpen(true);
      return;
    }
    // Paywall promises resolve on dismissal; do not hold a React action transition open.
    void premium
      .presentPaywall()
      .catch(() => toast.error(t`Could not open Premium. Please try again.`));
  }

  function closeSignIn() {
    setSignInOpen(false);
    openPremiumAfterSignIn.current = false;
  }

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
        <div className="text-accent-800 dark:text-accent-200 mb-4 flex min-h-10 items-center gap-2 text-sm">
          {!isOnline ? (
            <output className="flex items-center gap-2">
              <Icon icon="lucide.wifi-off" className="size-4 shrink-0" />
              <Trans>You seem to be offline.</Trans>
            </output>
          ) : sessionStatus === "pending" ? (
            <output>
              <Trans>Checking account…</Trans>
            </output>
          ) : sessionStatus === "unavailable" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <output>
                <Trans>We couldn’t check your account.</Trans>
              </output>
              <Button
                className="h-auto w-auto rounded-sm py-1 font-semibold underline underline-offset-4"
                pressAction={async () => {
                  await session.refetch();
                }}
              >
                <Trans>Retry</Trans>
              </Button>
            </div>
          ) : user ? (
            <output className="flex min-w-0 items-center gap-2">
              <Icon icon="lucide.check" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                <Trans>Signed in as {email}</Trans>
              </span>
            </output>
          ) : (
            <Button
              className="h-auto w-auto rounded-sm py-1 font-semibold underline underline-offset-4"
              onPress={() => setSignInOpen(true)}
            >
              <Trans>Sign in</Trans>
            </Button>
          )}
        </div>
        <PremiumCodeRedemption
          userId={user?.id ?? null}
          initialCode={initialCode}
          onCodeChange={setCode}
          isDisabled={isOnline && isAccountUnavailable}
          onSignIn={() => setSignInOpen(true)}
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
            search={{ returnTo: `/redeem?${new URLSearchParams({ code })}` }}
            onClose={closeSignIn}
            onSignedIn={() => {
              if (openPremiumAfterSignIn.current) openPremium();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
