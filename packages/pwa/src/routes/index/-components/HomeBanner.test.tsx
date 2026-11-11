import { PwaUIProvider } from "#src/components/PwaUIProvider.js";
// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PremiumContextProvider, type PremiumStatus } from "#src/lib/premium/PremiumContext.ts";
import { AdvertisingProvider } from "#src/lib/advertising/AdvertisingContext.ts";
import { HomeBanner } from "./HomeBanner.tsx";

import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { DataHarness } from "#src/lib/testing/DataHarness.tsx";
import { createProfileRuntime } from "#src/lib/testing/profileRuntime.ts";

let runtime: Awaited<ReturnType<typeof createProfileRuntime>>;
let status: PremiumStatus = "free";
let isVisible = true;
const rootRoute = createRootRoute({ component: () => <HomeBanner isVisible={isVisible} /> });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/cloud-sync",
});

let router: ReturnType<typeof createRouter>;

let root: Root;
let container: HTMLDivElement;
const presentPaywall = vi.fn<() => Promise<null>>();
const releaseAdProtection = vi.fn<() => void>();
const registerProtectedFlow = vi.fn<() => () => void>(() => releaseAdProtection);

async function render(nextStatus: PremiumStatus = "free", nextVisible = true) {
  status = nextStatus;
  isVisible = nextVisible;
  await act(async () => {
    await router.invalidate();
  });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <AdvertisingProvider
            value={{
              privacyOptionsRequired: false,
              presentInterstitialOpportunity: () => false,
              registerProtectedFlow,
              showPrivacyOptions: async () => undefined,
            }}
          >
            <PremiumContextProvider
              value={{
                status,
                isPremium: status === "premium",
                hasActiveSubscription: status === "premium",
                presentPaywall,
                presentCustomerCenter: async () => undefined,
              }}
            >
              <DataHarness value={runtime.repo}>
                <RouterProvider router={router} />
              </DataHarness>
            </PremiumContextProvider>
          </AdvertisingProvider>
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
}

async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.includes(label) || button.getAttribute("aria-label") === label,
  );

  expect(button).toBeDefined();
  await act(async () => button!.click());
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  runtime = await createProfileRuntime();
  router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  presentPaywall.mockResolvedValue(null);
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React reads this optional test-only flag from the global object; production globals do not declare it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await runtime.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("gives incomplete profiles priority over the Premium offer", async () => {
  await act(async () => {
    runtime.local.change((doc) => {
      doc.username = "   ";
    });
  });
  await render();
  expect(container.textContent).toContain("Complete your profile");
  expect(container.textContent).not.toContain("Enjoy trizum ad-free");
  await act(async () => {
    runtime.local.change((doc) => {
      doc.username = "Alex";
    });
  });
  await render();
  expect(container.textContent).toContain("Enjoy trizum ad-free");
});

it("only promotes a resolved free native account", async () => {
  for (const status of ["premium", "loading", "error", "unavailable"] as const) {
    await render(status);
    expect(container.textContent).toBe("");
  }
});

it("does not promote native purchases on the web", async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  await render();
  expect(container.textContent).toBe("");
});

it("dismisses independently of opening the paywall and respects the saved preference", async () => {
  await render();
  await click("Dismiss Premium banner");
  expect(runtime.local.doc().premiumBannerDismissed).toBe(true);
  expect(presentPaywall).not.toHaveBeenCalled();
  await render();
  expect(container.textContent).toBe("");
});

it("opens Premium directly and protects the flow from ads until the paywall closes", async () => {
  let closePaywall!: (value: null) => void;
  presentPaywall.mockImplementation(
    () =>
      new Promise((resolve) => {
        closePaywall = resolve;
      }),
  );
  await render();
  await click("Enjoy trizum ad-free");
  expect(presentPaywall).toHaveBeenCalledOnce();
  expect(registerProtectedFlow).toHaveBeenCalledOnce();
  expect(releaseAdProtection).not.toHaveBeenCalled();
  await act(async () => closePaywall(null));
  expect(releaseAdProtection).toHaveBeenCalledOnce();
});

it("carries the Premium destination into the sign-in route", async () => {
  runtime.setSession(null);
  await render();
  await click("Enjoy trizum ad-free");
  expect(router.state.location.pathname).toBe("/settings/cloud-sync");
  expect(router.state.location.search).toMatchObject({ returnTo: "/?premium=true" });
  expect(presentPaywall).not.toHaveBeenCalled();
});
