// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import { PremiumPaywall, type PremiumPaywallServices } from "./PremiumPaywall.tsx";

const services = {
  loadPremiumOffering: vi.fn<PremiumPaywallServices["loadPremiumOffering"]>(),
  purchasePremiumPlan: vi.fn<PremiumPaywallServices["purchasePremiumPlan"]>(),
  restorePremiumPurchases: vi.fn<PremiumPaywallServices["restorePremiumPurchases"]>(),
  trackEvent: vi.fn<PremiumPaywallServices["trackEvent"]>(),
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, "error").mockReturnValue("error");
  vi.spyOn(toast, "success").mockReturnValue("success");
  services.loadPremiumOffering.mockRejectedValue(new Error("Offerings unavailable"));
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React reads this optional test-only global flag during act().
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );

  if (!element) throw new Error(`Missing button: ${label}`);

  return element;
}

async function renderPaywall(userId: string | null = "user-1") {
  const onEntitlementChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onEntitlementChange"]>();
  const onOpenChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onOpenChange"]>();
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PremiumPaywall
          isOpen
          services={services}
          onEntitlementChange={onEntitlementChange}
          onOpenChange={onOpenChange}
          sessionId={1}
          userId={userId}
        />
      </I18nProvider>,
    ),
  );

  return { onEntitlementChange, onOpenChange };
}

async function restore() {
  await act(async () => button("Restore purchases").click());
}

describe("Premium paywall restore recovery", () => {
  it.each(["error", "loading"] as const)(
    "keeps code redemption available when offerings are %s",
    async (status) => {
      if (status === "loading") services.loadPremiumOffering.mockReturnValue(new Promise(() => {}));
      await renderPaywall();
      expect(button("Redeem code").disabled).toBe(false);
    },
  );

  it.each(["error", "loading"] as const)("allows restore when offerings are %s", async (status) => {
    if (status === "loading") services.loadPremiumOffering.mockReturnValue(new Promise(() => {}));
    await renderPaywall();
    expect(button("Restore purchases").disabled).toBe(false);
    expect(button("Continue with Premium").disabled).toBe(true);
  });

  it("keeps restore unavailable without a signed-in account", async () => {
    await renderPaywall(null);
    expect(button("Restore purchases").disabled).toBe(true);
    await restore();
    expect(services.restorePremiumPurchases).not.toHaveBeenCalled();
    expect(services.trackEvent).not.toHaveBeenCalled();
  });

  it("applies a restored entitlement and closes the unavailable-offerings paywall", async () => {
    const entitlement = { hasActiveSubscription: true, isPremium: true };
    services.restorePremiumPurchases.mockResolvedValue(entitlement);
    const { onEntitlementChange, onOpenChange } = await renderPaywall();
    await restore();
    expect(services.restorePremiumPurchases).toHaveBeenCalledWith("user-1");
    expect(onEntitlementChange).toHaveBeenCalledWith(entitlement);
    expect(toast.success).toHaveBeenCalledWith("Premium purchases restored.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(services.trackEvent.mock.calls).toEqual([
      ["premium_restore_started"],
      ["premium_restore_completed"],
    ]);
  });

  it("explains an empty restore without dismissing the paywall", async () => {
    services.restorePremiumPurchases.mockResolvedValue({
      hasActiveSubscription: false,
      isPremium: false,
    });
    const { onOpenChange } = await renderPaywall();
    await restore();
    expect(toast.error).toHaveBeenCalledWith("No Premium purchase was found for this account.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(services.trackEvent.mock.calls).toEqual([
      ["premium_restore_started"],
      ["premium_restore_empty"],
    ]);
  });

  it("offers retry feedback when restoring fails", async () => {
    services.restorePremiumPurchases.mockRejectedValue(new Error("Store unavailable"));
    const { onEntitlementChange, onOpenChange } = await renderPaywall();
    await restore();
    expect(toast.error).toHaveBeenCalledWith("Purchases could not be restored. Please try again.");
    expect(onEntitlementChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(services.trackEvent.mock.calls).toEqual([
      ["premium_restore_started"],
      ["premium_restore_failed"],
    ]);
  });
});
