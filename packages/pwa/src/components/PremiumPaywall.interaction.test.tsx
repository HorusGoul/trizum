// @vitest-environment jsdom

import type * as ReactAriaComponents from "react-aria-components";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import {
  loadPremiumOffering,
  purchasePremiumPlan,
  restorePremiumPurchases,
} from "#src/lib/premium/premiumCommerce.ts";
import type { IconButton } from "#src/ui/IconButton.tsx";
import { PremiumPaywall } from "./PremiumPaywall.tsx";

vi.mock("react-aria-components", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactAriaComponents>()),
  Dialog: ({ children }: { children: ReactNode }) => children,
  Modal: ({ children }: { children: ReactNode }) => children,
  ModalOverlay: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? children : null,
}));
vi.mock("#src/ui/IconButton.tsx", () => ({
  IconButton: (props: ComponentProps<typeof IconButton>) => (
    <button
      aria-label={props["aria-label"]}
      disabled={props.isDisabled}
      onClick={() => props.onPress?.({} as never)}
    />
  ),
}));
vi.mock("#src/ui/Icon.tsx", () => ({ Icon: () => null }));
vi.mock("#src/lib/link.ts", () => ({ getAppLink: (path: string) => path }));
vi.mock("#src/lib/premium/premiumCommerce.ts", () => ({
  loadPremiumOffering: vi.fn<typeof loadPremiumOffering>(),
  purchasePremiumPlan: vi.fn<typeof purchasePremiumPlan>(),
  restorePremiumPurchases: vi.fn<typeof restorePremiumPurchases>(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn<typeof toast.error>(), success: vi.fn<typeof toast.success>() },
}));

let root: Root;
let container: HTMLDivElement;
const onEntitlementChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onEntitlementChange"]>();
const onOpenChange = vi.fn<ComponentProps<typeof PremiumPaywall>["onOpenChange"]>();

async function render(isOpen = true, sessionId = 1, userId = "user-1") {
  await act(async () => {
    root.render(
      <I18nProvider i18n={i18n}>
        <PremiumPaywall
          isOpen={isOpen}
          onEntitlementChange={onEntitlementChange}
          onOpenChange={onOpenChange}
          sessionId={sessionId}
          userId={userId}
        />
      </I18nProvider>,
    );
  });
}

function button(label: string) {
  const element = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label || candidate.textContent === label,
  );
  if (!element) throw new Error(`Missing button: ${label}`);
  return element;
}

beforeEach(() => {
  vi.resetAllMocks();
  i18n.load("en", {});
  i18n.activate("en");
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
  expect(container.textContent).toContain("Premium options are unavailable");
  expect(button("Close Premium").disabled).toBe(false);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
