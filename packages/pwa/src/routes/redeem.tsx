import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PremiumCodeRedemption } from "#src/components/PremiumCodeRedemption.tsx";
import { BackButton } from "#src/components/BackButton.tsx";
import { useAppSession } from "#src/lib/auth-client.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import { parseRedemptionSearch } from "#src/lib/premium/premiumRedemption.ts";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { Button } from "#src/ui/Button.tsx";

export const Route = createFileRoute("/redeem")({
  component: RedeemCode,
  validateSearch: parseRedemptionSearch,
});

function RedeemCode() {
  const { code } = Route.useSearch();
  const session = useAppSession();
  const userId = session.data?.user.id ?? null;
  const premium = usePremium();
  const platform = getRevenueCatPlatform();

  return (
    <div className="pb-safe flex min-h-full flex-col">
      <meta name="robots" content="noindex, nofollow" />
      <header className="mt-safe mx-auto flex h-16 w-full max-w-[480px] items-center gap-2 px-2">
        <BackButton fallbackOptions={{ to: "/settings" }} />
        <span className="text-lg font-bold tracking-tight">
          <Trans>trizum Premium</Trans>
        </span>
      </header>
      <main className="mx-auto w-full max-w-[480px] px-6 pt-6 pb-8">
        <h1 className="text-2xl leading-tight font-bold tracking-tight">
          <Trans>Redeem code</Trans>
        </h1>
        <p className="text-accent-600 dark:text-accent-300 mt-2 mb-7 text-sm leading-relaxed">
          <Trans>Use a promo code for trizum Premium.</Trans>
        </p>
        {platform && !userId ? (
          <p className="text-accent-700 dark:text-accent-200 mb-5 text-sm">
            <Trans>Sign in to your trizum account before redeeming.</Trans>{" "}
            <Link className="font-semibold underline underline-offset-2" to="/settings/cloud-sync">
              <Trans>Sign in</Trans>
            </Link>
          </p>
        ) : null}
        <PremiumCodeRedemption
          key={code}
          userId={userId}
          initialCode={code}
          isDisabled={Boolean(platform) && (session.isPending || Boolean(session.error))}
        />
        {platform && userId ? (
          <Button
            className="mt-3 font-semibold"
            color="input-like"
            onPress={() => void premium.presentPaywall()}
          >
            <Trans>View Premium options</Trans>
          </Button>
        ) : null}
        {premium.isPremium ? (
          <output className="text-accent-600 dark:text-accent-300 mt-4 flex items-center gap-2 text-sm font-medium">
            <Icon icon="lucide.check" className="size-4" />
            <Trans>Premium is active.</Trans>
          </output>
        ) : null}
      </main>
    </div>
  );
}
