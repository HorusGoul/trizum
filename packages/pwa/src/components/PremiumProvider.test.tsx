import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { ComponentProps } from "react";
import { usePremium, type PremiumContextValue } from "#src/lib/premium/PremiumContext.ts";
import type { PremiumPaywall } from "./PremiumPaywall.tsx";
import { PremiumProvider } from "./PremiumProvider.tsx";

const paywall = vi.hoisted(() => ({ props: null as ComponentProps<typeof PremiumPaywall> | null }));
vi.mock("#src/lib/auth-client.ts", () => ({
  useAppSession: () => ({ data: { user: { id: "test-user" } }, isPending: false, error: null }),
}));
vi.mock("#src/lib/premium/revenueCatConfig.ts", () => ({ getRevenueCatPlatform: () => null }));
vi.mock("./PremiumPaywall.tsx", () => ({
  PremiumPaywall: (props: ComponentProps<typeof PremiumPaywall>) => {
    paywall.props = props;
    return null;
  },
}));

let premium: PremiumContextValue;
function CapturePremium() {
  premium = usePremium();
  return null;
}

beforeEach(() => {
  renderToStaticMarkup(
    <PremiumProvider>
      <CapturePremium />
    </PremiumProvider>,
  );
});

it("returns no new entitlement when the paywall is dismissed", async () => {
  const result = premium.presentPaywall();
  paywall.props!.onOpenChange(false);
  await expect(result).resolves.toBeNull();
});

it("returns the purchase or restore result and clears it when reopening", async () => {
  const result = premium.presentPaywall();
  const entitlement = { isPremium: true, hasActiveSubscription: true };
  paywall.props!.onEntitlementChange(entitlement);
  paywall.props!.onOpenChange(false);
  await expect(result).resolves.toEqual(entitlement);
  const reopened = premium.presentPaywall();
  paywall.props!.onOpenChange(false);
  await expect(reopened).resolves.toBeNull();
});
