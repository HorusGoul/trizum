import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PremiumRedemptionHelp } from "./PremiumRedemptionHelp.tsx";
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

const storeButtonClassName =
  "border-accent-200 bg-accent-50 text-accent-950 hover:border-accent-400 hover:bg-accent-100 focus-visible:ring-accent-500 dark:border-accent-800 dark:bg-accent-900 dark:text-accent-50 dark:hover:border-accent-600 dark:hover:bg-accent-800 flex h-auto min-h-18 items-center justify-start gap-4 rounded-2xl border px-4 py-3 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2";

export function PremiumCodeRedemption({
  userId,
  initialCode = "",
  isDisabled = false,
  onBusyChange,
  onSignIn,
  onOpenPremium,
  onCodeChange,
}: {
  userId: string | null;
  initialCode?: string;
  isDisabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onSignIn?: () => void;
  onOpenPremium: () => void;
  onCodeChange?: (code: string) => void;
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
        onChange={(value) => {
          setCode(value);
          onCodeChange?.(value);
        }}
        maxLength={128}
        autoComplete="off"
        isDisabled={isDisabled && Boolean(platform)}
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
              isDisabled={isDisabled && Boolean(platform)}
              pressAction={copyCode}
            />
          ) : null}
        </div>
      </TextField>

      <div className="flex flex-col gap-3">
        {platform ? (
          <Button
            className={storeButtonClassName}
            aria-label={platform === "ios" ? t`Redeem in App Store` : t`Redeem in Google Play`}
            isDisabled={!userId || isDisabled}
            pressAction={redeem}
          >
            <StoreRedemptionContent platform={platform} />
          </Button>
        ) : (
          <>
            {showApple ? <StoreRedemptionLink platform="ios" code={code} /> : null}
            {showGoogle ? <StoreRedemptionLink platform="android" code={code} /> : null}
          </>
        )}
      </div>

      <PremiumRedemptionHelp
        code={code}
        devicePlatform={devicePlatform}
        redeemAction={platform ? redeem : undefined}
        isDisabled={isDisabled}
        isSignedIn={Boolean(userId)}
        onSignIn={onSignIn}
        onOpenPremium={onOpenPremium}
      />
    </section>
  );
}

function StoreRedemptionLink({ platform, code }: { platform: "ios" | "android"; code: string }) {
  return (
    <a
      className={storeButtonClassName}
      aria-label={platform === "ios" ? t`Redeem in App Store` : t`Redeem in Google Play`}
      href={getStoreRedemptionUrl(platform, code)}
      rel="noreferrer"
      target="_blank"
    >
      <StoreRedemptionContent platform={platform} />
    </a>
  );
}

function StoreRedemptionContent({ platform }: { platform: "ios" | "android" }) {
  return (
    <>
      <Icon
        icon={platform === "ios" ? "brand.app-store" : "brand.google-play"}
        className="text-accent-600 dark:text-accent-300 size-7 shrink-0"
      />
      <span className="flex-1">
        <span className="block text-sm font-bold">
          {platform === "ios" ? <Trans>App Store</Trans> : <Trans>Google Play</Trans>}
        </span>
        <span className="text-accent-800 dark:text-accent-200 block text-xs">
          <Trans>Redeem your offer</Trans>
        </span>
      </span>
      <Icon icon="lucide.arrow-up-right" className="text-accent-500 dark:text-accent-400 size-4" />
    </>
  );
}
