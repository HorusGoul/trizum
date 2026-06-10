import "@fontsource-variable/inter";
import "@fontsource-variable/fira-code";
import * as ReactDOM from "react-dom/client";
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
import { UpdateController } from "./components/UpdateController.tsx";
import { MediaGalleryController } from "./components/MediaGalleryController.tsx";
import { usePartyList } from "./hooks/usePartyList.ts";
import { SafeArea } from "capacitor-plugin-safe-area";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { UpdateControllerNative } from "./components/UpdateControllerNative.tsx";
import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import * as Sentry from "@sentry/react";
import { getSentrySink } from "@logtape/sentry";
import { createLocalFirstTrizumDataClient } from "@trizum/data";
import { configurePwaLogging } from "./lib/log.ts";
import { createPartyFromMigrationData, type MigrationData } from "./models/migration.ts";
import { TrizumDataContext } from "./lib/data/TrizumDataContext.ts";
import {
  readPartyListState,
  seedPartyListState,
  type InternalPartyListSeed,
  type InternalPartyListSnapshot,
  type InternalPartyListSeedResult,
} from "./lib/testing/browserHarness.ts";

const initialUrl = new URL(window.location.href);
const isProduction = import.meta.env.MODE === "production";
const shouldInitializeSentry = isProduction && import.meta.env.VITE_APP_DISABLE_SENTRY !== "true";

if (shouldInitializeSentry) {
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
    enableLogs: true,
  });

  configurePwaLogging({
    lowestLevel: "info",
    extraSinks: {
      sentry: getSentrySink(),
    },
    extraLoggers: [{ category: [], lowestLevel: "error", sinks: ["sentry"] }],
  });
} else {
  configurePwaLogging({
    lowestLevel: isProduction ? "info" : "debug",
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
    routerOptions: Omit<NavigateOptions<RegisteredRouter>, keyof ToOptions<RegisteredRouter>>;
  }
}

const JAZZ_SERVER_URL = import.meta.env.VITE_APP_JAZZ_SERVER_URL?.trim() || undefined;
const INTERNAL_DB_NAME = initialUrl.searchParams.get("__internal_db_name")?.trim() || undefined;
const isOfflineOnly = initialUrl.searchParams.get("__internal_offline_only") === "true";

const trizumData = await createLocalFirstTrizumDataClient({
  dbName: INTERNAL_DB_NAME ?? "trizum-jazz-fate-pwa",
  disableBrowserWorker: isWebKitBrowser(),
  serverUrl: isOfflineOnly ? undefined : JAZZ_SERVER_URL,
});

declare global {
  interface Window {
    __internal_createPartyFromMigrationData: (data: MigrationData) => Promise<string>;
    __internal_seedPartyListState: (
      seed: InternalPartyListSeed,
    ) => Promise<InternalPartyListSeedResult>;
    __internal_readPartyListState: () => Promise<InternalPartyListSnapshot>;
  }
}

// For internal use only, like UI testing or screenshots
window.__internal_createPartyFromMigrationData = async (data: MigrationData) => {
  return createPartyFromMigrationData({
    client: trizumData.client,
    data,
    importAttachments: false,
    userId: trizumData.userId,
  });
};

window.__internal_seedPartyListState = async (seed: InternalPartyListSeed) => {
  return seedPartyListState({
    client: trizumData.client,
    seed,
    userId: trizumData.userId,
  });
};

window.__internal_readPartyListState = async () => {
  return readPartyListState({
    client: trizumData.client,
    userId: trizumData.userId,
  });
};

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { data: trizumData },
  defaultGcTime: 0,
  defaultStaleTime: Infinity,
});

let UpdateControllerComponent = UpdateController;

if (Capacitor.isNativePlatform()) {
  UpdateControllerComponent = UpdateControllerNative;

  void SafeArea.getSafeAreaInsets().then(({ insets }) => {
    for (const [key, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(`--safe-area-inset-${key}`, `${value}px`);
    }
  });

  void SafeArea.addListener("safeAreaChanged", ({ insets }) => {
    for (const [key, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(`--safe-area-inset-${key}`, `${value}px`);
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

    router.history.push(pathnameAndSearch);
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
          <TrizumDataContext value={trizumData}>
            <MediaGalleryController>
              <RouterProvider router={router} InnerWrap={InnerWrap} />
              <Toaster />
            </MediaGalleryController>
          </TrizumDataContext>
        </AriaProviders>
      </UpdateControllerComponent>
    </I18nProvider>,
  );
}

function AriaProviders({ children }: { children: React.ReactNode }) {
  const { i18n } = useLingui();
  return <AriaI18nProvider locale={i18n.locale}>{children}</AriaI18nProvider>;
}

function isWebKitBrowser() {
  return (
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR/i.test(navigator.userAgent)
  );
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

  return <>{children}</>;
}
