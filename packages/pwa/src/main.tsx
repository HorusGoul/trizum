import { useProfileId } from "#src/hooks/useProfileId.ts";
import type { ProfileEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView, FateClient } from "react-fate";
import { view } from "@nkzw/fate";
import { getBrowserLocale, setLocale } from "./lib/i18n.ts";
import { setThemeHue, defaultThemeHue } from "@trizum/ui/theme";
import {
  optionalNonemptySearchTextSchema,
  parseAppSearch,
  stringifyAppSearch,
} from "./lib/routerSearch.ts";
import type { AppSearch } from "./lib/routerSearch.ts";
import { Repo } from "@automerge/automerge-repo"; // inits automerge
import type { DocumentId } from "@automerge/automerge-repo/slim";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { createRecoveringStorage } from "./lib/recoveringStorage.ts";
import { RouterProvider, createBrowserHistory, createRouter } from "@tanstack/react-router";
import type {
  NavigateOptions,
  ParsedLocation,
  ToOptions,
  RegisteredRouter,
} from "@tanstack/react-router";
import { initializeAnalytics, trackPage } from "./lib/analytics.ts";
import { getTelemetryId, sentryTelemetryIntegration } from "./lib/telemetry.ts";
import { I18nProvider } from "@lingui/react";
import { PwaUIProvider } from "./components/PwaUIProvider.js";
import { Toaster } from "@trizum/ui/Toaster";
import { initializeI18n } from "./lib/i18n.js";
import { routeTree } from "./routeTree.gen.js";
import { UpdateController } from "./components/UpdateController.tsx";
import { MediaGalleryController } from "@trizum/ui/MediaGalleryController";
import { getAppData } from "./lib/data/client.ts";
import { SafeArea } from "capacitor-plugin-safe-area";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { UpdateControllerNative } from "./components/UpdateControllerNative.tsx";
import { PremiumProvider } from "./components/PremiumProvider.tsx";
import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { getSentrySink } from "@logtape/sentry";
import { sentryDocumentIdRedaction, sentryLoggerConfig } from "@trizum/logging/sentry";
import { isNonNull } from "./lib/isNonNull.ts";
import { configurePwaLogging, getLogger } from "./lib/log.ts";
import { appWorker, initializeAppWorker } from "./lib/appWorker/client.ts";
import { getAutomergeWssUrl, getIsAutomergeOfflineOnly } from "./lib/automergeSyncConfig.ts";
import { resolveNativeDeepLink } from "./lib/nativeDeepLinks.ts";
import {
  preventDuplicateHistoryEntries,
  pushHistoryWithoutDuplicateEntry,
  shouldNavigateToPartyListOnNativeBack,
} from "./lib/navigationHistory.ts";
import { createPartyFromMigrationData } from "./models/migration.ts";
import type { MigrationData } from "./models/migration.ts";
import type { Party } from "./models/party.ts";
import {
  createInactivePartyListState,
  readPartyListState,
  seedPartyListState,
} from "./lib/testing/browserHarness.ts";
import type { InternalPartyListSeed } from "./lib/testing/browserHarness.ts";

import * as ReactDOM from "react-dom/client";

import "./index.css";

import * as Sentry from "@sentry/react";

const ProfileAppearanceView = view<ProfileEntity>()({
  id: true,
  available: true,
  locale: true,
  hue: true,
});

const initialUrl = new URL(window.location.href);
const isProduction = import.meta.env.MODE === "production";
const shouldInitializeSentry = isProduction && import.meta.env.VITE_APP_DISABLE_SENTRY !== "true";

if (shouldInitializeSentry) {
  Sentry.init({
    ...sentryDocumentIdRedaction,
    dsn: "https://379ed68929ca4667e3466293189544a6@o524893.ingest.us.sentry.io/4510504067268608",
    integrations: [
      // eslint-disable-next-line import/namespace
      Sentry.browserTracingIntegration(),
      // eslint-disable-next-line import/namespace
      Sentry.browserProfilingIntegration(),
      ...sentryDocumentIdRedaction.integrations,
      sentryTelemetryIntegration,
    ],
    tracesSampleRate: 1,
    profileSessionSampleRate: 1,
    profileLifecycle: "trace",
    tracePropagationTargets: ["localhost", /trizum\.app/],
    environment: import.meta.env.MODE,
    enableLogs: true,
  });

  configurePwaLogging({
    getContext: () => ({ telemetryId: getTelemetryId() }),
    lowestLevel: "info",
    extraSinks: {
      sentry: getSentrySink(),
    },
    extraLoggers: [sentryLoggerConfig],
  });
} else {
  configurePwaLogging({
    getContext: () => ({ telemetryId: getTelemetryId() }),
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

const WSS_URL = getAutomergeWssUrl();
const isOfflineOnly = getIsAutomergeOfflineOnly(initialUrl.href);
const logger = getLogger("main");

type CalculatorSearchLocation = Pick<ParsedLocation<AppSearch>, "search">;

function hasCalculatorSearch(location: CalculatorSearchLocation | undefined) {
  const calculator = location?.search.calculator;

  return optionalNonemptySearchTextSchema.parse(calculator) !== undefined;
}

function shouldPreserveCalculatorSearchScroll({
  fromLocation,
  hashChanged,
  pathChanged,
  toLocation,
}: {
  fromLocation?: ParsedLocation;
  hashChanged: boolean;
  pathChanged: boolean;
  toLocation: ParsedLocation;
}) {
  return (
    !pathChanged &&
    !hashChanged &&
    (hasCalculatorSearch(fromLocation) || hasCalculatorSearch(toLocation))
  );
}

// Create automerge repository
const repo = new Repo({
  storage: createRecoveringStorage(),
  network: [isOfflineOnly ? null : new BrowserWebSocketClientAdapter(WSS_URL)].filter(isNonNull),
});

const deferredPartyListImports = new Map<DocumentId, Uint8Array>();

void initializeAppWorker({
  repo,
  wssUrl: WSS_URL,
  isOfflineOnly,
}).catch((error) => {
  logger.error("Failed to initialize app worker", { error });
});

// For internal use only, like UI testing or screenshots
window.__internal_createPartyFromMigrationData = async (data: MigrationData) => {
  const partyId = await createPartyFromMigrationData({
    repo,
    data,
    importAttachments: false,
  });

  await repo.flush();

  return partyId;
};

window.__internal_createDeferredPartyListState = async (seed: InternalPartyListSeed) => {
  const detachedRepo = new Repo({ network: [] });
  const result = createInactivePartyListState({ repo: detachedRepo, seed });
  const binary = await detachedRepo.export(result.partyListId);
  await detachedRepo.shutdown();

  if (!binary) {
    throw new Error("Expected the deferred party list to be exportable");
  }

  deferredPartyListImports.set(result.partyListId, binary);

  return result;
};

if (import.meta.env.VITE_E2E_HARNESS === "true") {
  const { installPartyBoostBrowserSeed } = await import("../e2e/harness/partyBoostBrowserSeed");
  installPartyBoostBrowserSeed(repo);
}

window.__internal_getDocumentState = (documentId: DocumentId) => {
  return repo.handles[documentId]?.state;
};

window.__internal_releaseDeferredPartyListState = (partyListId: DocumentId) => {
  const binary = deferredPartyListImports.get(partyListId);

  if (!binary) {
    throw new Error(`No deferred party list found for ${partyListId}`);
  }

  repo.import(binary, { docId: partyListId });
  deferredPartyListImports.delete(partyListId);
};

window.__internal_seedPartyListState = async (seed: InternalPartyListSeed) => {
  return seedPartyListState({
    repo,
    seed,
  });
};

window.__internal_readPartyListState = async () => {
  return readPartyListState({
    repo,
  });
};

window.__internal_recalculatePartyBalances = async (partyId: Party["id"]) => {
  return appWorker.recalculateBalances(partyId);
};

const data = getAppData(repo);

// Create a new router instance
const history = preventDuplicateHistoryEntries(createBrowserHistory());

const router = createRouter({
  parseSearch: parseAppSearch,
  stringifySearch: stringifyAppSearch,
  routeTree,
  history,
  context: { client: data.fate },
  defaultGcTime: 0,
  defaultStaleTime: Infinity,
});

initializeAnalytics(Object.values(router.routesById).map((route) => route.fullPath));

data.bindAnalytics(() => router.state.location.pathname);

router.subscribe("onResolved", () => trackPage(router.state.location.pathname));

router.subscribe("onBeforeNavigate", (event) => {
  if (shouldPreserveCalculatorSearchScroll(event)) {
    // Browser back/forward does not carry the calculator's resetScroll: false option.
    router._scroll.n = false;
  }
});

let UpdateControllerComponent = UpdateController;

if (Capacitor.isNativePlatform()) {
  UpdateControllerComponent = UpdateControllerNative;
  const handledNativeOpenUrls = new Set<string>();

  function handleNativeOpenUrl(rawUrl: string) {
    if (handledNativeOpenUrls.has(rawUrl)) {
      return;
    }

    handledNativeOpenUrls.add(rawUrl);
    window.setTimeout(() => handledNativeOpenUrls.delete(rawUrl), 1_000);

    void resolveNativeDeepLink(rawUrl).then(({ href }) => {
      if (href) {
        pushHistoryWithoutDuplicateEntry(router.history, href);
      }
    });
  }

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
    } else if (
      shouldNavigateToPartyListOnNativeBack({
        canGoBack,
        pathname: router.state.location.pathname,
      })
    ) {
      void router.navigate({ to: "/", replace: true });
    } else {
      void App.exitApp();
    }
  });

  void App.addListener("appUrlOpen", (event) => {
    handleNativeOpenUrl(event.url);
  });

  void App.getLaunchUrl().then((launchUrl) => {
    if (launchUrl?.url) {
      handleNativeOpenUrl(launchUrl.url);
    }
  });
}

// Render the app
const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <I18nProvider i18n={i18n}>
      <PwaUIProvider>
        <UpdateControllerComponent>
          <FateClient client={data.fate}>
            <MediaGalleryController>
              <PremiumProvider>
                <RouterProvider router={router} InnerWrap={InnerWrap} />
              </PremiumProvider>
              <Toaster />
            </MediaGalleryController>
          </FateClient>
        </UpdateControllerComponent>
      </PwaUIProvider>
    </I18nProvider>,
  );
}

function InnerWrap({ children }: { children: React.ReactNode }) {
  const client = useFateClient();
  const profileId = useProfileId();

  // Initialize the party list to set the locale and other
  // settings on bootstrap.
  const partyList = requireAvailable(
    useView(
      ProfileAppearanceView,
      client.ref<ProfileEntity>("Profile", profileId, ProfileAppearanceView),
    ),
  );

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);
  useEffect(() => {
    setThemeHue(partyList.hue ?? defaultThemeHue);
  }, [partyList.hue]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide();
    }
  }, []);

  return <>{children}</>;
}
