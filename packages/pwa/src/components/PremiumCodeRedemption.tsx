import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { Input, TextField } from "#src/ui/fields/TextField.tsx";
import { Label } from "#src/ui/fields/Field.tsx";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { openPremiumCodeRedemption } from "#src/lib/premium/revenueCatClient.ts";
import {
  detectRedemptionPlatform,
  getStoreRedemptionUrl,
} from "#src/lib/premium/premiumRedemption.ts";

export function PremiumCodeRedemption({
  userId,
  initialCode = "",
  isDisabled = false,
  onBusyChange,
}: {
  userId: string | null;
  initialCode?: string;
  isDisabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const platform = getRevenueCatPlatform();
  const devicePlatform =
    platform ??
    (typeof navigator === "undefined"
      ? undefined
      : detectRedemptionPlatform(navigator.userAgent, navigator.maxTouchPoints));
  const showApple = devicePlatform !== "android";
  const showGoogle = devicePlatform !== "ios";

  async function redeem() {
    onBusyChange?.(true);
    await openPremiumCodeRedemption(userId, code)
      .catch(() => {
        toast.error(t`Code redemption could not be opened. Please try again.`);
      })
      .finally(() => onBusyChange?.(false));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code.trim());
      toast.success(t`Code copied.`);
    } catch {
      toast.error(t`Could not copy the code. Select and copy it from the field above.`);
    }
  }

  return (
    <section aria-label={t`Redeem code`} className="flex flex-col gap-5">
      <TextField
        value={code}
        onChange={setCode}
        maxLength={128}
        autoComplete="off"
        isDisabled={isDisabled}
        className="flex flex-col gap-2"
      >
        <Label className="sr-only">
          <Trans>Promo code</Trans>
        </Label>
        <div className="relative">
          <Input
            className="border-accent-200 bg-accent-50 dark:border-accent-700 dark:bg-accent-900 h-14 rounded-2xl pr-14 font-mono text-base tracking-wider"
            placeholder={t`Promo code`}
            autoCapitalize="characters"
            spellCheck={false}
          />
          {code.trim() ? (
            <IconButton
              className="absolute top-2 right-2"
              icon="lucide.copy"
              aria-label={t`Copy code`}
              isDisabled={isDisabled}
              pressAction={copyCode}
            />
          ) : null}
        </div>
      </TextField>

      <div className="flex flex-col gap-3">
        {platform ? (
          <Button
            className="h-auto min-h-12 px-4 py-3 text-sm font-semibold"
            color="accent"
            isDisabled={!userId || isDisabled}
            pressAction={redeem}
          >
            {platform === "ios" ? (
              <Trans>Redeem in App Store</Trans>
            ) : (
              <Trans>Redeem in Google Play</Trans>
            )}
          </Button>
        ) : (
          <>
            {showApple ? <StoreRedemptionLink platform="ios" code={code} /> : null}
            {showGoogle ? <StoreRedemptionLink platform="android" code={code} /> : null}
          </>
        )}
      </div>

      <div className="border-accent-200 dark:border-accent-800 divide-accent-200 dark:divide-accent-800 divide-y border-t text-sm">
        {showGoogle ? (
          <details className="group">
            <summary className="text-accent-700 dark:text-accent-200 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
              <Trans>Code not working in Google Play?</Trans>
              <Icon icon="lucide.chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
            </summary>
            <p className="text-accent-600 dark:text-accent-300 pb-3 leading-relaxed">
              <Trans>
                Some offers need to be redeemed at checkout. Open trizum on Android, choose the plan
                for your offer, then tap the payment method in Google Play and select Redeem code.
                Check that your offer appears before confirming.
              </Trans>
            </p>
          </details>
        ) : null}
        <details className="group">
          <summary className="text-accent-700 dark:text-accent-200 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            <Trans>Already redeemed?</Trans>
            <Icon icon="lucide.chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
          </summary>
          <p className="text-accent-600 dark:text-accent-300 pb-3 leading-relaxed">
            <Trans>
              Open trizum on your phone and sign in to your account. Use Restore purchases if
              Premium has not appeared yet.
            </Trans>
          </p>
        </details>
      </div>
    </section>
  );
}

function StoreRedemptionLink({ platform, code }: { platform: "ios" | "android"; code: string }) {
  return (
    <a
      className="bg-accent-500 text-accent-50 hover:bg-accent-600 focus-visible:ring-accent-500 dark:bg-accent-500 dark:hover:bg-accent-400 flex min-h-12 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
      href={getStoreRedemptionUrl(platform, code)}
      rel="noreferrer"
      target="_blank"
    >
      {platform === "ios" ? (
        <Trans>Redeem in App Store</Trans>
      ) : (
        <Trans>Redeem in Google Play</Trans>
      )}
      <Icon icon="lucide.arrow-up-right" className="size-4" />
    </a>
  );
}
