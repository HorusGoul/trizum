import * as ReactDOM from "react-dom/client";
import { Repo } from "@automerge/automerge-repo"; // inits automerge
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import {
  RouterProvider,
  createRouter,
  type NavigateOptions,
  type ToOptions,
  type RegisteredRouter,
} from "@tanstack/react-router";
import "./index.css";
import { I18nProvider, useLingui } from "@lingui/react";
import { I18nProvider as AriaI18nProvider } from "react-aria-components";
import { Toaster } from "./ui/Toaster.js";
import { initializeI18n } from "./lib/i18n.js";
// Import the generated route tree
import { routeTree } from "./routeTree.gen.js";
import { preloadAllIcons } from "./preloadIcons.gen.js";
import { PartyTheme } from "./components/PartyTheme.tsx";
import { UpdateController } from "./components/UpdateController.tsx";
import { MediaGalleryController } from "./components/MediaGalleryController.tsx";
import { usePartyList } from "./hooks/usePartyList.ts";
import { RepoContext } from "./lib/automerge/RepoContext.ts";
import { SafeArea } from "capacitor-plugin-safe-area";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { UpdateControllerNative } from "./components/UpdateControllerNative.tsx";
import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import * as Sentry from "@sentry/react";
import { isNonNull } from "./lib/isNonNull.ts";
import {
  createPartyFromMigrationData,
  type MigrationData,
} from "./models/migration.ts";

const initialUrl = new URL(window.location.href);

if (import.meta.env.MODE === "production") {
  Sentry.init({
    dsn: "https://379ed68929ca4667e3466293189544a6@o524893.ingest.us.sentry.io/4510504067268608",
    integrations: [
      // eslint-disable-next-line import/namespace
      Sentry.browserTracingIntegration(),
      // eslint-disable-next-line import/namespace
      Sentry.browserProfilingIntegration(),
    ],
    tracesSampleRate: 1,
    profileSessionSampleRate: 1,
    profileLifecycle: "trace",
    tracePropagationTargets: ["localhost", /trizum\.app/],
    environment: import.meta.env.MODE,
  });
}

// Initialize i18n
const i18n = initializeI18n();

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

type Routes = NonNullable<ToOptions["to"]>;
type Href = {
  [To in Routes]: ToOptions<RegisteredRouter, string, To>;
}[Routes];

declare module "react-aria-components" {
  interface RouterConfig {
    href: Href;
    routerOptions: Omit<
      NavigateOptions<RegisteredRouter>,
      keyof ToOptions<RegisteredRouter>
    >;
  }
}

const WSS_URL = import.meta.env.VITE_APP_WSS_URL ?? "wss://dev-sync.trizum.app";
const isOfflineOnly =
  initialUrl.searchParams.get("__internal_offline_only") === "true";

// Create automerge repository
const repo = new Repo({
  storage: new IndexedDBStorageAdapter("trizum"),
  network: [
    isOfflineOnly ? null : new BrowserWebSocketClientAdapter(WSS_URL),
  ].filter(isNonNull),
});

declare global {
  interface Window {
    __internal_createPartyFromMigrationData: (
      data: MigrationData,
    ) => Promise<string>;
  }
}

// For internal use only, like UI testing or screenshots
window.__internal_createPartyFromMigrationData = async (
  data: MigrationData,
) => {
  return createPartyFromMigrationData({
    repo,
    data,
    importAttachments: false,
  });
};

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { repo },
  defaultGcTime: 0,
  defaultStaleTime: Infinity,
});

void preloadAllIcons();

let UpdateControllerComponent = UpdateController;

if (Capacitor.isNativePlatform()) {
  UpdateControllerComponent = UpdateControllerNative;

  void SafeArea.getSafeAreaInsets().then(({ insets }) => {
    for (const [key, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(
        `--safe-area-inset-${key}`,
        `${value}px`,
      );
    }
  });

  void SafeArea.addListener("safeAreaChanged", ({ insets }) => {
    for (const [key, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(
        `--safe-area-inset-${key}`,
        `${value}px`,
      );
    }
  });

  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      router.history.go(-1);
    } else {
      void App.exitApp();
    }
  });

  void App.addListener("appUrlOpen", (event) => {
    const url = new URL(event.url);

    const pathnameAndSearch = url.pathname + url.search;

    void router.history.push(pathnameAndSearch);
  });
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <I18nProvider i18n={i18n}>
      <UpdateControllerComponent>
        <AriaProviders>
          <RepoContext value={repo}>
            <MediaGalleryController>
              <RouterProvider router={router} InnerWrap={InnerWrap} />
              <Toaster />
            </MediaGalleryController>
          </RepoContext>
        </AriaProviders>
      </UpdateControllerComponent>
    </I18nProvider>,
  );
}

function AriaProviders({ children }: { children: React.ReactNode }) {
  const { i18n } = useLingui();
  return <AriaI18nProvider locale={i18n.locale}>{children}</AriaI18nProvider>;
}

function InnerWrap({ children }: { children: React.ReactNode }) {
  // Initialize the party list to set the locale and other
  // settings on bootstrap.
  usePartyList();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide();
    }
  }, []);

  return (
    <>
      <PartyTheme />
      {children}
    </>
  );
}
