import { PwaUIProvider } from "#src/components/PwaUIProvider.js";
// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import {
  type loadPremiumOffering as LoadPremiumOffering,
  type purchasePremiumPlan as PurchasePremiumPlan,
  type restorePremiumPurchases as RestorePremiumPurchases,
} from "#src/lib/premium/premiumCommerce.ts";
import { PremiumPaywall } from "./PremiumPaywall.tsx";
import type { trackEvent as TrackEvent } from "#src/lib/analytics.ts";

const loadPremiumOffering = vi.fn<typeof LoadPremiumOffering>();
const purchasePremiumPlan = vi.fn<typeof PurchasePremiumPlan>();
const restorePremiumPurchases = vi.fn<typeof RestorePremiumPurchases>();
const trackEvent = vi.fn<typeof TrackEvent>();
const services = { loadPremiumOffering, purchasePremiumPlan, restorePremiumPurchases, trackEvent };

let root: Root;
let container: HTMLDivElement;
const onEntitlementChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onEntitlementChange"]>();
const onOpenChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onOpenChange"]>();

async function render(isOpen = true, sessionId = 1, userId = "user-1") {
  await act(async () => {
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <PremiumPaywall
            services={services}
            isOpen={isOpen}
            onEntitlementChange={onEntitlementChange}
            onOpenChange={onOpenChange}
            sessionId={sessionId}
            userId={userId}
          />
        </PwaUIProvider>
      </I18nProvider>,
    );
  });
}

function button(label: string) {
  const element = Array.from(document.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label || candidate.textContent === label,
  );

  if (!element) throw new Error(`Missing button: ${label}`);

  return element;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, "success").mockReturnValue("success");
  vi.spyOn(toast, "error").mockReturnValue("error");
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React reads this optional test-only flag from the global object; production globals do not declare it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(loadPremiumOffering).mockResolvedValue({
    defaultPlanId: "annual",
    plans: [{ id: "annual", price: "€9.99", pricePerMonth: null, trial: null }],
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it.each(["purchase", "restore"] as const)(
  "can close while a %s is stalled without starting a duplicate on reopen",
  async (action) => {
    const operation = action === "purchase" ? purchasePremiumPlan : restorePremiumPurchases;
    const pending = deferred<Awaited<ReturnType<typeof restorePremiumPurchases>>>();
    vi.mocked(restorePremiumPurchases).mockReturnValue(pending.promise);
    vi.mocked(purchasePremiumPlan).mockImplementation(async () => ({
      status: "purchased",
      entitlement: await pending.promise,
    }));
    const label = action === "purchase" ? "Continue with Premium" : "Restore purchases";
    await render();
    await act(async () => {
      button(label).click();
      button("Continue with Premium").click();
      button("Restore purchases").click();
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(button("Continue with Premium").disabled).toBe(true);
    expect(button("Restore purchases").disabled).toBe(true);
    expect(button("Close Premium").disabled).toBe(false);
    await act(async () => button("Close Premium").click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await render(false);
    await render(true, 2);
    expect(button(label).disabled).toBe(true);
    expect(button("Close Premium").disabled).toBe(false);
    await act(async () => {
      button("Continue with Premium").click();
      button("Restore purchases").click();
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(
      action === "purchase" ? restorePremiumPurchases : purchasePremiumPlan,
    ).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ isPremium: false, hasActiveSubscription: false }));
    expect(button("Continue with Premium").disabled).toBe(false);
    expect(button("Restore purchases").disabled).toBe(false);
    expect(vi.mocked(trackEvent).mock.calls).toEqual(
      action === "purchase"
        ? [["premium_purchase_started"], ["premium_purchase_completed"]]
        : [["premium_restore_started"], ["premium_restore_empty"]],
    );
  },
);

it.each(["purchased", "cancelled", "failed"] as const)(
  "reports the %s purchase outcome without transaction properties",
  async (outcome) => {
    if (outcome === "failed") {
      vi.mocked(purchasePremiumPlan).mockRejectedValue(new Error("Private store error"));
    } else if (outcome === "cancelled") {
      vi.mocked(purchasePremiumPlan).mockResolvedValue({ status: "cancelled" });
    } else {
      vi.mocked(purchasePremiumPlan).mockResolvedValue({
        status: "purchased",
        entitlement: { isPremium: true, hasActiveSubscription: true },
      });
    }

    await render();
    expect(trackEvent).not.toHaveBeenCalled();
    await act(async () => button("Continue with Premium").click());
    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ["premium_purchase_started"],
      [outcome === "purchased" ? "premium_purchase_completed" : `premium_purchase_${outcome}`],
    ]);
    expect(onEntitlementChange).toHaveBeenCalledTimes(outcome === "purchased" ? 1 : 0);
  },
);

it.each(["purchase", "restore"] as const)(
  "ignores a late %s result after dismissal and account switching",
  async (action) => {
    const pending = deferred<Awaited<ReturnType<typeof restorePremiumPurchases>>>();
    vi.mocked(restorePremiumPurchases).mockReturnValue(pending.promise);
    vi.mocked(purchasePremiumPlan).mockImplementation(async () => ({
      status: "purchased",
      entitlement: await pending.promise,
    }));
    await render();
    await act(async () =>
      button(action === "purchase" ? "Continue with Premium" : "Restore purchases").click(),
    );
    await act(async () => button("Close Premium").click());
    await render(false);
    await render(true, 2, "user-2");
    onOpenChange.mockClear();
    await act(async () => pending.resolve({ isPremium: true, hasActiveSubscription: true }));
    expect(onEntitlementChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(button("Restore purchases").disabled).toBe(false);
  },
);

it("does not show a late billing failure after returning to the app", async () => {
  const pending = deferred<Awaited<ReturnType<typeof restorePremiumPurchases>>>();
  vi.mocked(restorePremiumPurchases).mockReturnValue(pending.promise);
  await render();
  await act(async () => button("Restore purchases").click());
  await act(async () => button("Close Premium").click());
  await render(false);
  await act(async () => pending.reject(new Error("Billing unavailable")));
  expect(toast.error).not.toHaveBeenCalled();
  expect(onEntitlementChange).not.toHaveBeenCalled();
  await render(true, 2);
  expect(button("Continue with Premium").disabled).toBe(false);
  expect(button("Restore purchases").disabled).toBe(false);
});

it("keeps a failed or stalled product lookup dismissible", async () => {
  vi.mocked(loadPremiumOffering).mockImplementationOnce(() => new Promise<never>(() => {}));
  await render();
  expect(button("Close Premium").disabled).toBe(false);
  await act(async () => button("Close Premium").click());
  expect(onOpenChange).toHaveBeenCalledWith(false);
  await render(false);
  vi.mocked(loadPremiumOffering).mockRejectedValueOnce(new Error("Billing unavailable"));
  await render(true, 2);
  expect(document.body.textContent).toContain("Premium options are unavailable");
  expect(button("Close Premium").disabled).toBe(false);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
