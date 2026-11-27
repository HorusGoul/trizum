import { trackEvent } from "#src/lib/analytics.ts";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useOnlineStatus } from "#src/hooks/useOnlineStatus.ts";
import { PremiumRedemptionHelp } from "./PremiumRedemptionHelp.tsx";
import { toast } from "sonner";
import { StoreRedemptionAction } from "./StoreRedemptionAction.tsx";
import { Icon } from "@trizum/ui/Icon";
import { IconButton } from "@trizum/ui/IconButton";
import { Input, TextField } from "@trizum/ui/fields/TextField";
import { Label } from "@trizum/ui/fields/Field";
import { getRevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";
import { openPremiumCodeRedemption } from "#src/lib/premium/revenueCatClient.ts";
import { detectRedemptionPlatform } from "#src/lib/premium/premiumRedemption.ts";

const storeButtonClassName =
  "border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-400 hover:bg-neutral-100 focus-visible:ring-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 flex h-auto min-h-18 items-center justify-start gap-4 rounded-2xl border px-4 py-3 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2";

export function PremiumCodeRedemption({
  userId,
  code,
  isDisabled = false,
  onBusyChange,
  onSignIn,
  onOpenPremium,
  onCodeChange,
}: {
  userId: string | null;
  code: string;
  isDisabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onSignIn?: () => void;
  onOpenPremium: () => void;
  onCodeChange: (code: string) => void;
}) {
  const isOnline = useOnlineStatus();
  const platform = getRevenueCatPlatform();

  const devicePlatform =
    platform ??
    (typeof navigator === "undefined"
      ? undefined
      : detectRedemptionPlatform(navigator.userAgent, navigator.maxTouchPoints));

  const platforms = devicePlatform ? [devicePlatform] : (["ios", "android"] as const);

  async function redeem() {
    onBusyChange?.(true);
    trackEvent("premium_redemption_requested");
    await openPremiumCodeRedemption(userId, code)
      .catch(() => {
        toast.error(t`Code redemption could not be opened. Please try again.`);
      })
      .finally(() => onBusyChange?.(false));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code.trim());
      trackEvent("premium_code_copied");
      toast.success(t`Code copied.`);
    } catch {
      toast.error(t`Could not copy the code. Select and copy it from the field above.`);
    }
  }

  return (
    <section aria-label={t`Redeem code`} className="flex flex-col gap-5">
      <TextField
        value={code}
        onChange={onCodeChange}
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
            className="h-14 rounded-2xl border-neutral-200 bg-neutral-50 pr-14 font-mono text-base tracking-wider dark:border-neutral-700 dark:bg-neutral-900"
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
        {platforms.map((store) => (
          <StoreRedemptionAction
            key={store}
            platform={store}
            code={code}
            className={storeButtonClassName}
            aria-label={store === "ios" ? t`Redeem in App Store` : t`Redeem in Google Play`}
            isDisabled={isDisabled}
            redeemAction={platform && userId ? redeem : undefined}
          >
            <StoreRedemptionContent platform={store} />
          </StoreRedemptionAction>
        ))}
      </div>

      <PremiumRedemptionHelp
        code={code}
        devicePlatform={devicePlatform}
        redeemAction={platform && userId ? redeem : undefined}
        isDisabled={isDisabled}
        isSignedIn={Boolean(userId)}
        isOffline={!isOnline}
        onSignIn={onSignIn}
        onOpenPremium={onOpenPremium}
      />
    </section>
  );
}

function StoreRedemptionContent({ platform }: { platform: "ios" | "android" }) {
  return (
    <>
      <Icon
        icon={platform === "ios" ? "brand.app-store" : "brand.google-play"}
        className="size-7 shrink-0 text-neutral-600 dark:text-neutral-300"
      />
      <span className="flex-1">
        <span className="block text-sm font-bold">
          {platform === "ios" ? <Trans>App Store</Trans> : <Trans>Google Play</Trans>}
        </span>
        <span className="block text-xs text-neutral-800 dark:text-neutral-200">
          <Trans>Redeem your offer</Trans>
        </span>
      </span>
      <Icon
        icon="lucide.arrow-up-right"
        className="size-4 text-neutral-500 dark:text-neutral-400"
      />
    </>
  );
}
