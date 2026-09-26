import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ComponentProps, ReactNode } from "react";
import type * as ReactAriaComponents from "react-aria-components";
import type * as PremiumPaywallState from "#src/lib/premium/premiumPaywallState.ts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import {
  type loadPremiumOffering,
  type purchasePremiumPlan,
  restorePremiumPurchases,
} from "#src/lib/premium/premiumCommerce.ts";
import { getCurrentPremiumPaywallLoadState } from "#src/lib/premium/premiumPaywallState.ts";
import type { Button } from "#src/ui/Button.tsx";
import { PremiumPaywall } from "./PremiumPaywall.tsx";

const buttons = vi.hoisted(() => new Map<string, ComponentProps<typeof Button>>());

vi.mock("react-aria-components", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactAriaComponents>()),
  Dialog: ({ children }: { children: ReactNode }) => children,
  Modal: ({ children }: { children: ReactNode }) => children,
  ModalOverlay: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("#src/ui/Button.tsx", () => ({
  Button: (props: ComponentProps<typeof Button>) => {
    buttons.set(
      renderToStaticMarkup(
        <I18nProvider i18n={i18n}>
          <span>{props.children as ReactNode}</span>
        </I18nProvider>,
      ),
      props,
    );
    return null;
  },
}));
vi.mock("#src/ui/IconButton.tsx", () => ({ IconButton: () => null }));
vi.mock("#src/lib/link.ts", () => ({ getAppLink: (path: string) => path }));
vi.mock("#src/lib/premium/premiumCommerce.ts", () => ({
  loadPremiumOffering: vi.fn<typeof loadPremiumOffering>(),
  purchasePremiumPlan: vi.fn<typeof purchasePremiumPlan>(),
  restorePremiumPurchases: vi.fn<typeof restorePremiumPurchases>(),
}));
vi.mock("#src/lib/premium/premiumPaywallState.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof PremiumPaywallState>()),
  getCurrentPremiumPaywallLoadState: vi.fn<typeof getCurrentPremiumPaywallLoadState>(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn<typeof toast.error>(), success: vi.fn<typeof toast.success>() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  buttons.clear();
  i18n.load("en", {});
  i18n.activate("en");
  vi.mocked(getCurrentPremiumPaywallLoadState).mockReturnValue({
    loadKey: "1:user-1",
    status: "error",
  });
});

function renderPaywall(userId: string | null = "user-1") {
  const onEntitlementChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onEntitlementChange"]>();
  const onOpenChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onOpenChange"]>();
  renderToStaticMarkup(
    <I18nProvider i18n={i18n}>
      <PremiumPaywall
        isOpen
        onEntitlementChange={onEntitlementChange}
        onOpenChange={onOpenChange}
        sessionId={1}
        userId={userId}
      />
    </I18nProvider>,
  );
  const restoreButton = buttons.get("<span>Restore purchases</span>");
  if (!restoreButton) {
    throw new Error("Restore purchases button was not rendered");
  }
  return { onEntitlementChange, onOpenChange, restoreButton };
}

describe("Premium paywall restore recovery", () => {
  it.each(["error", "loading"] as const)("allows restore when offerings are %s", (status) => {
    vi.mocked(getCurrentPremiumPaywallLoadState).mockReturnValue({ loadKey: "1:user-1", status });
    const { restoreButton } = renderPaywall();
    expect(restoreButton.isDisabled).toBe(false);
    expect(buttons.get("<span>Continue with Premium</span>")?.isDisabled).toBe(true);
  });

  it("keeps restore unavailable without a signed-in account", () => {
    expect(renderPaywall(null).restoreButton.isDisabled).toBe(true);
  });

  it("applies a restored entitlement and closes the unavailable-offerings paywall", async () => {
    const entitlement = { hasActiveSubscription: true, isPremium: true };
    vi.mocked(restorePremiumPurchases).mockResolvedValue(entitlement);
    const { restoreButton, onEntitlementChange, onOpenChange } = renderPaywall();
    await restoreButton.pressAction?.({} as never);
    expect(restorePremiumPurchases).toHaveBeenCalledWith("user-1");
    expect(onEntitlementChange).toHaveBeenCalledWith(entitlement);
    expect(toast.success).toHaveBeenCalledWith("Premium purchases restored.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("explains an empty restore without dismissing the paywall", async () => {
    vi.mocked(restorePremiumPurchases).mockResolvedValue({
      hasActiveSubscription: false,
      isPremium: false,
    });
    const { restoreButton, onOpenChange } = renderPaywall();
    await restoreButton.pressAction?.({} as never);
    expect(toast.error).toHaveBeenCalledWith("No Premium purchase was found for this account.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("offers retry feedback when restoring fails", async () => {
    vi.mocked(restorePremiumPurchases).mockRejectedValue(new Error("Store unavailable"));
    const { restoreButton, onEntitlementChange, onOpenChange } = renderPaywall();
    await restoreButton.pressAction?.({} as never);
    expect(toast.error).toHaveBeenCalledWith("Purchases could not be restored. Please try again.");
    expect(onEntitlementChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
