/**
 * React context provider for the Trizum SDK.
 *
 * This provider makes the TrizumClient available to all components in the tree.
 */

import { createContext, use, type ReactNode } from "react";
import type { TrizumClient } from "../client.js";
import type { Repo } from "../internal/automerge.js";

interface TrizumContextValue {
  client: TrizumClient;
}

const TrizumContext = createContext<TrizumContextValue | null>(null);

/**
 * @internal
 * Internal Repo context for backwards compatibility during migration.
 * This is not part of the public API and should not be used directly.
 */
export const RepoContext = createContext<Repo | null>(null);

export interface TrizumProviderProps {
  children: ReactNode;
  client: TrizumClient;
}

/**
 * Provider component that makes the TrizumClient available to all child components.
 *
 * @example
 * ```tsx
 * const client = new TrizumClient({ syncUrl: "wss://sync.example.com" });
 *
 * function App() {
 *   return (
 *     <TrizumProvider client={client}>
 *       <MyApp />
 *     </TrizumProvider>
 *   );
 * }
 * ```
 */
export function TrizumProvider({ children, client }: TrizumProviderProps) {
  const value: TrizumContextValue = {
    client,
  };

  return <TrizumContext value={value}>{children}</TrizumContext>;
}

/**
 * Hook to access the TrizumClient from context.
 *
 * @throws Error if used outside of a TrizumProvider
 */
export function useTrizumClient(): TrizumClient {
  const context = use(TrizumContext);

  if (!context) {
    throw new Error("useTrizumClient must be used within a TrizumProvider");
  }

  return context.client;
}

/**
 * @internal
 * Hook to access the internal repository.
 * This is for internal SDK use and backwards compatibility only.
 */
export function useRepo(): Repo {
  // Try TrizumContext first (full SDK pattern)
  const trizumContext = use(TrizumContext);
  if (trizumContext) {
    return trizumContext.client._internalRepo;
  }

  // Fall back to standalone RepoContext (backwards compatibility)
  const repoContext = use(RepoContext);
  if (repoContext) {
    return repoContext;
  }

  throw new Error(
    "useRepo must be used within a TrizumProvider or RepoContext",
  );
}

// Re-export for internal use
export { TrizumContext };
