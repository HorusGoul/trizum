/**
 * React context provider for the Trizum SDK.
 *
 * This provider makes the TrizumClient available to all components in the tree.
 */

import { createContext, use, type ReactNode } from "react";
import type { ITrizumClient } from "../client.js";
import { InternalTrizumContext } from "../internal/repo-context.js";

/**
 * Internal context value type for public client access.
 */
interface TrizumContextValue {
  client: ITrizumClient;
}

const TrizumContext = createContext<TrizumContextValue | null>(null);

export interface TrizumProviderProps {
  children: ReactNode;
  /**
   * The Trizum client instance (TrizumClient or TrizumWorkerClient).
   */
  client: ITrizumClient;
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
  const publicValue: TrizumContextValue = { client };
  // Internal context uses unknown cast to avoid exposing internal types
  const internalValue = { client: client as unknown };

  return (
    <InternalTrizumContext value={internalValue as never}>
      <TrizumContext value={publicValue}>{children}</TrizumContext>
    </InternalTrizumContext>
  );
}

/**
 * Hook to access the TrizumClient from context.
 *
 * @throws Error if used outside of a TrizumProvider
 */
export function useTrizumClient(): ITrizumClient {
  const context = use(TrizumContext);

  if (!context) {
    throw new Error("useTrizumClient must be used within a TrizumProvider");
  }

  return context.client;
}
