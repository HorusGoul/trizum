import { createContext, use } from "react";
import type { AppData } from "./client.ts";

export const DataContext = createContext<AppData | null>(null);

export function useAppData() {
  const data = use(DataContext);

  if (!data) throw new Error("Application data provider is missing");

  return data;
}
