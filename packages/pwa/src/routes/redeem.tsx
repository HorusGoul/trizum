import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { PremiumCodeRedemption } from "#src/components/PremiumCodeRedemption.tsx";
import { BackButton } from "#src/components/BackButton.tsx";
import { useAppSession } from "#src/lib/auth-client.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import { parseRedemptionSearch } from "#src/lib/premium/premiumRedemption.ts";
import { PremiumBrowserHelp } from "#src/components/PremiumBrowserHelp.tsx";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { Icon } from "#src/ui/Icon.tsx";

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
  const [isBrowserHelpOpen, setBrowserHelpOpen] = useState(false);
  const [isSignInOpen, setSignInOpen] = useState(false);
  const openPremiumAfterSignIn = useRef(false);
  const [premiumUserId, setPremiumUserId] = useState<string | null>(null);
  const openedPremiumUser = useRef<string | null>(null);
  const session = useAppSession();
  const user = session.data?.user;
  const email = user?.email;
  const premium = usePremium();

  function showPremium() {
    // Paywall promises resolve on dismissal; do not hold a React action transition open.
    void premium
      .presentPaywall()
      .catch(() => toast.error(t`Could not open Premium. Please try again.`));
  }

  const resumePremium = useEffectEvent(showPremium);
  useEffect(() => {
    // Wait for PremiumProvider to observe the account before opening its dialog.
    if (!premiumUserId || user?.id !== premiumUserId || openedPremiumUser.current === premiumUserId)
      return;
    openedPremiumUser.current = premiumUserId;
    resumePremium();
  }, [premiumUserId, user?.id]);

  function requestSignIn() {
    setSignInOpen(true);
  }

  function openPremium() {
    if (!getRevenueCatPlatform()) {
      setBrowserHelpOpen(true);
      return;
    }
    if (user) showPremium();
    else {
      openPremiumAfterSignIn.current = true;
      requestSignIn();
    }
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
        {user ? (
          <output className="text-accent-800 dark:text-accent-200 mb-4 flex min-h-10 min-w-0 items-center gap-2 text-sm">
            <Icon icon="lucide.check" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              <Trans>Signed in as {email}</Trans>
            </span>
          </output>
        ) : null}
        <PremiumCodeRedemption
          userId={user?.id ?? null}
          initialCode={initialCode}
          onCodeChange={setCode}
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
      {isBrowserHelpOpen ? <PremiumBrowserHelp onClose={() => setBrowserHelpOpen(false)} /> : null}
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
            onSignedIn={(userId) => {
              if (openPremiumAfterSignIn.current) setPremiumUserId(userId);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
