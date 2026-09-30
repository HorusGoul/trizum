import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useEffectEvent } from "react";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { usePartyList } from "#src/hooks/usePartyList.ts";
import { usePremiumDialogs } from "#src/hooks/usePremiumDialogs.ts";
import { useAppSession } from "#src/lib/auth-client.ts";
import { useAdProtectedFlow } from "#src/lib/advertising/AdvertisingContext.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { ProfileSetupCard } from "./ProfileSetupCard.tsx";

export function HomeBanner({ isVisible }: { isVisible: boolean }) {
  const { partyList, dismissPremiumBanner } = usePartyList();
  const navigate = useNavigate();
  const isHome = useLocation({ select: (location) => location.pathname === "/" });
  const resumePremium = useSearch({ strict: false, select: (search) => search.premium });
  const session = useAppSession();
  const premium = usePremium();
  const isNative = Boolean(getRevenueCatPlatform());
  const dialogs = usePremiumDialogs({
    userId: session.data?.user.id ?? null,
    isNative,
    presentPaywall: premium.presentPaywall,
  });
  useAdProtectedFlow(dialogs.dialog.kind !== "closed");

  const resumeAfterSignIn = useEffectEvent(() => {
    // Consume the return intent so navigation and later sign-ins cannot replay it.
    void navigate({ to: "/", search: { premium: undefined }, replace: true });
    if (isNative && session.data?.user) dialogs.openPremium();
  });
  useEffect(() => {
    if (isHome && resumePremium && !session.isPending) resumeAfterSignIn();
  }, [isHome, resumePremium, session.isPending]);

  function openPremium() {
    if (session.data?.user) {
      dialogs.openPremium();
    } else {
      // The route owns sign-in, including magic-link callbacks and cloud-profile choice.
      void navigate({ to: "/settings/cloud-sync", search: { returnTo: "/?premium=true" } });
    }
  }

  const needsProfileSetup = !partyList.username?.trim();
  const showPremium = isNative && premium.status === "free" && !partyList.premiumBannerDismissed;

  return (
    <>
      {isVisible && (needsProfileSetup || showPremium) ? (
        <div className="container mb-4 px-2">
          {needsProfileSetup ? (
            <ProfileSetupCard />
          ) : (
            <div className="border-accent-400 bg-accent-50 dark:border-accent-500 dark:bg-accent-950 flex items-start rounded-xl border">
              <Button
                onPress={openPremium}
                isDisabled={dialogs.dialog.kind !== "closed"}
                className="text-accent-950 dark:text-accent-50 hover:bg-accent-100 focus-visible:bg-accent-100 dark:hover:bg-accent-900 dark:focus-visible:bg-accent-900 focus-visible:ring-accent-500 flex min-w-0 flex-1 cursor-pointer items-start gap-4 rounded-xl p-4 text-start outline-hidden focus-visible:ring-2 focus-visible:ring-inset"
              >
                <div className="-mt-0.5 flex h-8 w-8 shrink-0 justify-center">
                  <Icon icon="lucide.sparkles" className="text-accent-600 dark:text-accent-400" />
                </div>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-lg leading-tight font-semibold">
                    <Trans>Enjoy trizum ad-free</Trans>
                  </span>
                  <span className="text-accent-700 dark:text-accent-300 text-sm">
                    <Trans>Explore Premium</Trans>
                  </span>
                </span>
              </Button>
              <IconButton
                icon="lucide.x"
                aria-label={t`Dismiss Premium banner`}
                onPress={dismissPremiumBanner}
                isDisabled={dialogs.dialog.kind !== "closed"}
                className="text-accent-600 dark:text-accent-400 mt-2 mr-2 shrink-0"
                iconClassName="size-5"
              />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
