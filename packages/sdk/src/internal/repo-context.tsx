/**
 * @internal
 * Internal repo context and hooks for SDK use only.
 * This module is not part of the public API.
 */

import { createContext, use } from "react";
import type { Repo } from "./crdt.js";
import { INTERNAL_REPO_SYMBOL } from "./symbols.js";

/**
 * Internal type for accessing the repo from a client.
 */
interface ClientWithRepo {
  [INTERNAL_REPO_SYMBOL]: Repo;
}

/**
 * Internal context value type.
 */
interface InternalContextValue {
  client: ClientWithRepo;
}

/**
 * Internal context for accessing the client with repo.
 */
export const InternalTrizumContext = createContext<InternalContextValue | null>(
  null,
);

/**
 * @internal
 * Hook to access the internal repository.
 * This is for internal SDK use only.
 */
export function useInternalRepo(): Repo {
  const context = use(InternalTrizumContext);
  if (!context) {
    throw new Error("useInternalRepo must be used within a TrizumProvider");
  }
  return context.client[INTERNAL_REPO_SYMBOL];
}
