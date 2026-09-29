// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PremiumContextProvider, type PremiumStatus } from "#src/lib/premium/PremiumContext.ts";
import { AdvertisingProvider } from "#src/lib/advertising/AdvertisingContext.ts";
import { HomeBanner } from "./HomeBanner.tsx";

const state = vi.hoisted(() => ({
  username: "Alex",
  premiumBannerDismissed: false,
  userId: "account-a" as string | null,
  isNative: true,
}));
const dismiss = vi.hoisted(() =>
  vi.fn<() => void>(() => {
    state.premiumBannerDismissed = true;
  }),
);
vi.mock("#src/hooks/usePartyList.ts", () => ({
  usePartyList: () => ({ partyList: state, dismissPremiumBanner: dismiss }),
}));
vi.mock("#src/lib/auth-client.ts", () => ({
  useAppSession: () => ({ data: state.userId ? { user: { id: state.userId } } : null }),
}));
vi.mock("#src/lib/premium/revenueCatConfig.ts", () => ({
  getRevenueCatPlatform: () => (state.isNative ? "android" : undefined),
}));
vi.mock("#src/components/CloudSyncSettingsView.tsx", () => ({
  CloudSyncSettingsView: ({
    onSignedIn,
    onClose,
  }: {
    onSignedIn: (id: string) => void;
    onClose: () => void;
  }) => (
    <button
      onClick={() => {
        onSignedIn("account-a");
        onClose();
      }}
    >
      Finish sign-in
    </button>
  ),
}));

let root: Root;
let container: HTMLDivElement;
const presentPaywall = vi.fn<() => Promise<null>>();
const releaseAdProtection = vi.fn<() => void>();
const registerProtectedFlow = vi.fn<() => () => void>(() => releaseAdProtection);

async function render(status: PremiumStatus = "free", isVisible = true) {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
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
            <HomeBanner isVisible={isVisible} />
          </PremiumContextProvider>
        </AdvertisingProvider>
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

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    username: "Alex",
    premiumBannerDismissed: false,
    userId: "account-a",
    isNative: true,
  });
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
});

it("gives incomplete profiles priority over the Premium offer", async () => {
  state.username = "   ";
  await render();
  expect(container.textContent).toContain("Complete your profile");
  expect(container.textContent).not.toContain("Enjoy trizum ad-free");
  state.username = "Alex";
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
  state.isNative = false;
  await render();
  expect(container.textContent).toBe("");
});

it("dismisses independently of opening the paywall and respects the saved preference", async () => {
  await render();
  await click("Dismiss Premium banner");
  expect(dismiss).toHaveBeenCalledOnce();
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

it("continues to Premium after sign-in even if the cloud profile changes the home content", async () => {
  state.userId = null;
  await render();
  await click("Enjoy trizum ad-free");
  expect(container.textContent).toContain("Finish sign-in");
  expect(presentPaywall).not.toHaveBeenCalled();
  await render("loading", false);
  await click("Finish sign-in");
  expect(presentPaywall).not.toHaveBeenCalled();
  state.userId = "account-a";
  await render("loading", false);
  expect(presentPaywall).toHaveBeenCalledOnce();
});
