import { Trans } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { StoreRedemptionAction } from "./StoreRedemptionAction.tsx";

const helpLinkClassName =
  "font-semibold underline decoration-current underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2";

export function PremiumRedemptionHelp({
  code,
  devicePlatform,
  redeemAction,
  isDisabled,
  isSignedIn,
  isOffline,
  onSignIn,
  onOpenPremium,
}: {
  code: string;
  devicePlatform: "ios" | "android" | undefined;
  redeemAction?: () => Promise<void>;
  isDisabled: boolean;
  isSignedIn: boolean;
  isOffline: boolean;
  onSignIn?: () => void;
  onOpenPremium: () => void;
}) {
  return (
    <div className="border-accent-200 dark:border-accent-800 divide-accent-200 dark:divide-accent-800 divide-y border-t text-sm">
      <details className="group">
        <summary className="text-accent-950 dark:text-accent-50 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
          <Trans>How do I redeem my code?</Trans>
          <Icon icon="lucide.chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <ol className="text-accent-900 dark:text-accent-100 list-decimal space-y-2 pb-3 pl-5 leading-relaxed">
          {!isSignedIn ? (
            <li>
              <Trans>
                Open trizum on your phone and{" "}
                <HelpButton onPress={onSignIn} isDisabled={isDisabled || isOffline}>
                  sign in
                </HelpButton>{" "}
                to the account you want to use for Premium.
              </Trans>
            </li>
          ) : null}
          <li>
            {devicePlatform === "ios" ? (
              <Trans>
                Copy your code, then open{" "}
                <StoreRedemptionAction
                  className={`inline h-auto w-auto rounded-sm text-inherit ${helpLinkClassName}`}
                  platform="ios"
                  code={code}
                  redeemAction={redeemAction}
                  isDisabled={isDisabled}
                >
                  App Store
                </StoreRedemptionAction>
                .
              </Trans>
            ) : devicePlatform === "android" ? (
              <Trans>
                Copy your code, then open{" "}
                <StoreRedemptionAction
                  className={`inline h-auto w-auto rounded-sm text-inherit ${helpLinkClassName}`}
                  platform="android"
                  code={code}
                  redeemAction={redeemAction}
                  isDisabled={isDisabled}
                >
                  Google Play
                </StoreRedemptionAction>
                .
              </Trans>
            ) : (
              <Trans>
                Open this link on your phone and copy your code. Choose{" "}
                <StoreRedemptionAction
                  className={`inline h-auto w-auto rounded-sm text-inherit ${helpLinkClassName}`}
                  platform="ios"
                  code={code}
                >
                  App Store
                </StoreRedemptionAction>{" "}
                for iPhone or iPad, or{" "}
                <StoreRedemptionAction
                  className={`inline h-auto w-auto rounded-sm text-inherit ${helpLinkClassName}`}
                  platform="android"
                  code={code}
                >
                  Google Play
                </StoreRedemptionAction>{" "}
                for Android.
              </Trans>
            )}
          </li>
          <li>
            <Trans>
              Follow the store's instructions and enter your code if asked. Check the offer before
              confirming.
            </Trans>
          </li>
          <li>
            <Trans>
              Return to trizum on your phone. Open{" "}
              <HelpButton onPress={onOpenPremium} isDisabled={isDisabled || isOffline}>
                Premium settings
              </HelpButton>{" "}
              and use Restore purchases if Premium has not appeared yet.
            </Trans>
          </li>
        </ol>
      </details>
      {devicePlatform !== "ios" ? (
        <details className="group">
          <summary className="text-accent-950 dark:text-accent-50 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            <Trans>Code not working in Google Play?</Trans>
            <Icon icon="lucide.chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
          </summary>
          <p className="text-accent-900 dark:text-accent-100 pb-3 leading-relaxed">
            <Trans>
              Some offers need to be redeemed at checkout. Open{" "}
              <HelpButton onPress={onOpenPremium} isDisabled={isDisabled || isOffline}>
                Premium settings
              </HelpButton>{" "}
              in trizum on Android and choose the plan for your offer. Then tap the payment method
              in Google Play and select Redeem code. Check that your offer appears before
              confirming.
            </Trans>
          </p>
        </details>
      ) : null}
      <details className="group">
        <summary className="text-accent-950 dark:text-accent-50 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
          <Trans>Already redeemed?</Trans>
          <Icon icon="lucide.chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <p className="text-accent-900 dark:text-accent-100 pb-3 leading-relaxed">
          <Trans>
            Open{" "}
            <HelpButton onPress={onOpenPremium} isDisabled={isDisabled || isOffline}>
              Premium settings
            </HelpButton>{" "}
            and use Restore purchases if Premium has not appeared yet.
          </Trans>
        </p>
      </details>
    </div>
  );
}

function HelpButton({
  children,
  onPress,
  isDisabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  isDisabled: boolean;
}) {
  return (
    <Button
      className={`inline h-auto w-auto rounded-sm text-inherit ${helpLinkClassName}`}
      onPress={onPress}
      isDisabled={isDisabled || !onPress}
    >
      {children}
    </Button>
  );
}
