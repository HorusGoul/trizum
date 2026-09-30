// @vitest-environment jsdom

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

const state = vi.hoisted(() => ({
  session: {
    data: { user: { id: "account-a", email: "test@example.com" } } as {
      user: { id: string; email: string };
    } | null,
    isPending: false,
    isOffline: false,
    error: null,
  },
  cloudChoiceOpen: false,
}));
vi.mock("#src/hooks/usePartyList.ts", () => ({
  usePartyList: () => ({ partyList: { id: "same-profile", username: "Alex", phone: "" } }),
}));
vi.mock("#src/lib/auth-client.ts", () => ({ useAppSession: () => state.session }));
vi.mock("#src/lib/premium/revenueCatConfig.ts", () => ({ getRevenueCatPlatform: () => "android" }));
// An unchanged cloud profile resolves without calling onCloudDataActivated.
vi.mock("#src/hooks/useCloudSyncAccountState.ts", () => ({
  useCloudSyncAccountState: ({
    onCloudDataActivated,
  }: {
    onCloudDataActivated: (delay: boolean) => void;
  }) => ({
    activateCloudSyncOnDevice: () => onCloudDataActivated(false),
    isAccountStateResolved: true,
    isCloudSyncSwitchOpen: state.cloudChoiceOpen,
    linkedProviderIds: new Set<string>(),
  }),
}));
vi.mock("#src/components/CloudSyncAccountSettings.tsx", () => ({
  CloudSyncAccountSettings: () => <p>Account settings</p>,
}));
vi.mock("#src/components/CloudSyncDialogs.tsx", () => ({
  CloudSyncSignInDialog: ({
    isOpen,
    onOpenChange,
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (isOpen ? <button onClick={() => onOpenChange(false)}>Cancel sign-in</button> : null),
  AuthCallbackErrorDialog: () => null,
  CloudActionConfirmationDialog: () => null,
  DeleteAccountDialog: () => null,
  CloudSyncSwitchDialog: ({
    isOpen,
    onUseCloudData,
  }: {
    isOpen: boolean;
    onUseCloudData: () => void;
  }) => (isOpen ? <button onClick={onUseCloudData}>Use cloud data</button> : null),
  SignInSuccessOverlay: () => <p>Sign-in complete</p>,
}));

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
    validateSearch: (search: Record<string, unknown>) => ({
      premium: search.premium === true ? true : undefined,
    }),
  });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
  const callbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/cloud-sync",
    validateSearch: (search: Record<string, unknown>) => ({
      auth: search.auth === "success" ? ("success" as const) : undefined,
      returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
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
        <PremiumContextProvider
          value={{
            status: "free",
            isPremium: false,
            hasActiveSubscription: false,
            presentPaywall,
            presentCustomerCenter: async () => undefined,
          }}
        >
          <RouterProvider router={router} />
        </PremiumContextProvider>
      </I18nProvider>,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  state.session.data = { user: { id: "account-a", email: "test@example.com" } };
  state.cloudChoiceOpen = false;
  presentPaywall.mockResolvedValue(null);
  i18n.load("en", {});
  i18n.activate("en");
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
  state.cloudChoiceOpen = true;
  const router = makeRouter("/?premium=true");
  await router.load();
  await render(router);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
  });
  expect(router.state.location.pathname).toBe("/settings/cloud-sync");
  expect(presentPaywall).not.toHaveBeenCalled();
  const chooseCloud = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Use cloud data",
  );
  expect(chooseCloud).toBeDefined();
  await act(async () => chooseCloud!.click());
  expect(router.state.location.pathname).toBe("/");
  expect(presentPaywall).toHaveBeenCalledOnce();
});

it("cancels sign-in without leaving an intent that a later account resolution can replay", async () => {
  state.session.data = null;
  const router = makeRouter("/?premium=true");
  await router.load();
  await render(router);
  const cancel = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Cancel sign-in",
  );
  expect(cancel).toBeDefined();
  await act(async () => cancel!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 220));
  });
  expect(router.state.location.pathname).toBe("/");
  expect(router.state.location.search).not.toHaveProperty("premium", true);
  state.session.data = { user: { id: "account-a", email: "test@example.com" } };
  await render(router);
  expect(presentPaywall).not.toHaveBeenCalled();
});
