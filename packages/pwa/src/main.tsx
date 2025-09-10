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
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Toaster } from "./ui/Toaster.js";
import * as catalogEn from "#locale/en/messages.po";
// Import the generated route tree
import { routeTree } from "./routeTree.gen.js";
import { preloadAllIcons } from "./preloadIcons.gen.js";

// Load language
i18n.load("en", catalogEn.messages);
i18n.activate("en");

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
  network: [new BrowserWebSocketClientAdapter("wss://sync.automerge.org")],
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
      <RepoContext.Provider value={repo}>
        <RouterProvider router={router} />
        <Toaster />
      </RepoContext.Provider>
    </I18nProvider>,
  );
}
