import type { Repo } from "@automerge/automerge-repo/slim";
import { FateClient } from "react-fate";
import { getAppData } from "../data/client.ts";

export function DataHarness({ value, children }: { value: Repo; children: React.ReactNode }) {
  return <FateClient client={getAppData(value).fate}>{children}</FateClient>;
}
