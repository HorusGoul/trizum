/**
 * React context provider for the Trizum SDK.
 *
 * This provider makes the TrizumClient and underlying Repo available
 * to all components in the tree via React Context.
 */

import { createContext, use, type ReactNode } from "react";
import type { Repo } from "@automerge/automerge-repo";
import type { TrizumClient } from "../client.js";

interface TrizumContextValue {
  client: TrizumClient;
  repo: Repo;
}

const TrizumContext = createContext<TrizumContextValue | null>(null);

/**
 * Standalone Repo context for backwards compatibility.
 *
 * Use this when you want to provide a Repo directly without using the full
 * TrizumClient. This is useful when migrating existing code that already
 * creates its own Repo instance.
 *
 * @example
 * ```tsx
 * const repo = new Repo({ storage, network });
 *
 * function App() {
 *   return (
 *     <RepoContext value={repo}>
 *       <MyApp />
 *     </RepoContext>
 *   );
 * }
 * ```
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
    repo: client.getRepo(),
  };

  return <TrizumContext value={value}>{children}</TrizumContext>;
}

/**
 * Hook to access the TrizumClient from context.
 *
 * @throws Error if used outside of a TrizumProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useTrizumClient();
 *   // Use client for operations
 * }
 * ```
 */
export function useTrizumClient(): TrizumClient {
  const context = use(TrizumContext);

  if (!context) {
    throw new Error("useTrizumClient must be used within a TrizumProvider");
  }

  return context.client;
}

/**
 * Hook to access the underlying Automerge Repo from context.
 *
 * This hook supports both:
 * 1. TrizumProvider (via TrizumContext) - for full SDK usage
 * 2. RepoContext (standalone) - for backwards compatibility
 *
 * @throws Error if used outside of a TrizumProvider or RepoContext
 */
export function useRepo(): Repo {
  // Try TrizumContext first (full SDK pattern)
  const trizumContext = use(TrizumContext);
  if (trizumContext) {
    return trizumContext.repo;
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

// Re-export for backwards compatibility
export { TrizumContext };
