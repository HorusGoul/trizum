import * as ReactDOM from "react-dom/client";
import { Repo } from "@automerge/automerge-repo"; // inits automerge
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
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

// Create automerge repository
const repo = new Repo({
  storage: new IndexedDBStorageAdapter("trizum"),
  network: [new BrowserWebSocketClientAdapter("wss://dev-sync.trizum.app")],
});

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { repo },
  defaultGcTime: 0,
  defaultStaleTime: Infinity,
});

preloadAllIcons();

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <I18nProvider i18n={i18n}>
      <UpdateController>
        <AriaProviders>
          <RepoContext.Provider value={repo}>
            <MediaGalleryController>
              <RouterProvider router={router} InnerWrap={InnerWrap} />
              <Toaster />
            </MediaGalleryController>
          </RepoContext.Provider>
        </AriaProviders>
      </UpdateController>
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

  return (
    <>
      <PartyTheme />
      {children}
    </>
  );
}
