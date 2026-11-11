import type { Repo } from "@automerge/automerge-repo/slim";
import { DataProvider } from "../data/context.tsx";
import { getAppData } from "../data/client.ts";

export function DataHarness({ value, children }: { value: Repo; children: React.ReactNode }) {
  return <DataProvider data={getAppData(value)}>{children}</DataProvider>;
}
