import { createContext, use } from "react";
import type { createLocalFirstTrizumDataClient } from "@trizum/data";

export type TrizumDataContextValue = Awaited<ReturnType<typeof createLocalFirstTrizumDataClient>>;

export const TrizumDataContext = createContext<TrizumDataContextValue | null>(null);

export function useTrizumData() {
  const value = use(TrizumDataContext);

  if (!value) {
    throw new Error("Should be inside a TrizumDataContext");
  }

  return value;
}
