import type { ReactNode } from "react";
import { Button } from "#src/ui/Button.tsx";
import { getStoreRedemptionUrl } from "#src/lib/premium/premiumRedemption.ts";
import { checkRedemptionConnection } from "#src/lib/premium/redemptionConnection.ts";
import type { RevenueCatPlatform } from "#src/lib/premium/revenueCatConfig.ts";

export function StoreRedemptionAction({
  platform,
  code,
  redeemAction,
  isDisabled = false,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  platform: RevenueCatPlatform;
  code: string;
  redeemAction?: () => Promise<void>;
  isDisabled?: boolean;
  children: ReactNode;
  className: string;
  "aria-label"?: string;
}) {
  if (redeemAction) {
    return (
      <Button
        className={className}
        aria-label={ariaLabel}
        isDisabled={isDisabled}
        pressAction={async () => {
          if (checkRedemptionConnection()) await redeemAction();
        }}
      >
        {children}
      </Button>
    );
  }
  return (
    <a
      className={className}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || undefined}
      href={getStoreRedemptionUrl(platform, code)}
      onClick={(event) => {
        if (isDisabled || !checkRedemptionConnection()) event.preventDefault();
      }}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
