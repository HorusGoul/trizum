import { PwaUIProvider } from "#src/components/PwaUIProvider.js";
// @vitest-environment jsdom

import { optionalSearchTextSchema } from "#src/lib/routerSearch.ts";
import type { AppSearch } from "#src/lib/routerSearch.ts";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PremiumContextProvider } from "#src/lib/premium/PremiumContext.ts";
import { CloudSyncSettingsView } from "#src/components/CloudSyncSettingsView.tsx";
import { HomeBanner } from "./HomeBanner.tsx";

import { DataHarness } from "#src/lib/testing/DataHarness.tsx";
import { createProfileRuntime } from "#src/lib/testing/profileRuntime.ts";

let runtime: Awaited<ReturnType<typeof createProfileRuntime>>;

const presentPaywall = vi.fn<() => Promise<null>>();
let root: Root;
let container: HTMLDivElement;

function makeRouter(returnTo: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <HomeBanner isVisible />
        <Outlet />
      </>
    ),
    validateSearch: (search: AppSearch) => ({
      premium: search.premium === true ? true : undefined,
    }),
  });

  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });

  const callbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/cloud-sync",
    validateSearch: (search: AppSearch) => ({
      auth: search.auth === "success" ? ("success" as const) : undefined,
      returnTo: optionalSearchTextSchema.parse(search.returnTo),
    }),
    component: function Callback() {
      const search = useSearch({ strict: false });

      return <CloudSyncSettingsView search={search} />;
    },
  });

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, callbackRoute]),
    history: createMemoryHistory({
      initialEntries: [
        `/settings/cloud-sync?auth=success&returnTo=${encodeURIComponent(returnTo)}`,
      ],
    }),
  });
}

type TestRouter = ReturnType<typeof makeRouter>;

async function render(router: TestRouter) {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <PremiumContextProvider
            value={{
              status: "free",
              isPremium: false,
              hasActiveSubscription: false,
              presentPaywall,
              presentCustomerCenter: async () => undefined,
            }}
          >
            <DataHarness value={runtime.repo}>
              <RouterProvider router={router} />
            </DataHarness>
          </PremiumContextProvider>
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  localStorage.clear();
  runtime = await createProfileRuntime();
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

it("resumes Premium after the real callback view completes with an unchanged cloud profile", async () => {
  const router = makeRouter("/?premium=true");
  await router.load();
  await render(router);
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
  });
  expect(router.state.location.pathname).toBe("/");
  expect(presentPaywall).toHaveBeenCalledOnce();
  expect(router.state.location.search).not.toHaveProperty("premium", true);
  expect(container.textContent).not.toContain("Account settings");
});

it("does not open Premium after an unrelated sign-in", async () => {
  const router = makeRouter("/");
  await router.load();
  await render(router);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
  });
  expect(router.state.location.pathname).toBe("/");
  expect(presentPaywall).not.toHaveBeenCalled();
});

it("waits for the cloud-profile choice before resuming Premium", async () => {
  runtime.requireCloudChoice();
  const router = makeRouter("/?premium=true");
  await router.load();
  await render(router);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
  });
  expect(router.state.location.pathname).toBe("/settings/cloud-sync");
  expect(presentPaywall).not.toHaveBeenCalled();

  const chooseCloud = [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Use cloud data",
  );

  expect(chooseCloud).toBeDefined();
  await act(async () => chooseCloud!.click());
  expect(router.state.location.pathname).toBe("/");
  expect(presentPaywall).toHaveBeenCalledOnce();
});

it("cancels sign-in without leaving an intent that a later account resolution can replay", async () => {
  runtime.setSession(null);
  const router = makeRouter("/?premium=true");
  await router.load();
  await render(router);

  const cancel = [...document.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === "Close sign-in",
  );

  expect(cancel).toBeDefined();
  await act(async () => cancel!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 220));
  });
  expect(router.state.location.pathname).toBe("/");
  expect(router.state.location.search).not.toHaveProperty("premium", true);
  await act(async () => {
    runtime.setSession("account-a");
  });
  await render(router);
  expect(presentPaywall).not.toHaveBeenCalled();
});
