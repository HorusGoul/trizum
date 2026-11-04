// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { ComponentProps } from "react";
import { usePremium, type PremiumContextValue } from "#src/lib/premium/PremiumContext.ts";
import type { PremiumPaywall } from "./PremiumPaywall.tsx";
import { PremiumProviderState } from "./PremiumProvider.tsx";

const paywall = vi.hoisted<{ props: ComponentProps<typeof PremiumPaywall> | null }>(() => ({
  props: null,
}));

function Paywall(props: ComponentProps<typeof PremiumPaywall>) {
  paywall.props = props;

  return null;
}

const capturePremium = vi.fn<(value: PremiumContextValue) => void>();

function CapturePremium() {
  capturePremium(usePremium());

  return null;
}

beforeEach(() => {
  capturePremium.mockClear();
  renderToStaticMarkup(
    <PremiumProviderState
      userId="test-user"
      hasSessionError={false}
      isSessionPending={false}
      platform={undefined}
      Paywall={Paywall}
    >
      <CapturePremium />
    </PremiumProviderState>,
  );
});

it("returns no new entitlement when the paywall is dismissed", async () => {
  const premium = capturePremium.mock.lastCall![0];
  const result = premium.presentPaywall();
  paywall.props!.onOpenChange(false);
  await expect(result).resolves.toBeNull();
});

it("returns the purchase or restore result and clears it when reopening", async () => {
  const premium = capturePremium.mock.lastCall![0];
  const result = premium.presentPaywall();
  const entitlement = { isPremium: true, hasActiveSubscription: true };
  paywall.props!.onEntitlementChange(entitlement);
  paywall.props!.onOpenChange(false);
  await expect(result).resolves.toEqual(entitlement);
  const reopened = premium.presentPaywall();
  paywall.props!.onOpenChange(false);
  await expect(reopened).resolves.toBeNull();
});
