import { StrictMode } from "react";
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
import { PartyListProvider } from "#src/hooks/usePartyListProvider";
import "./index.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

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
  storage: new IndexedDBStorageAdapter("opencount"),
  network: [new BrowserWebSocketClientAdapter("wss://sync.automerge.org")],
});

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RepoContext.Provider value={repo}>
        <PartyListProvider>
          <RouterProvider router={router} />
        </PartyListProvider>
      </RepoContext.Provider>
    </StrictMode>,
  );
}
