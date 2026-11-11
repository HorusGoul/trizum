import { DataContext } from "./useAppData.ts";
import { FateClient } from "react-fate";
import type { AppData } from "./client.ts";

export function DataProvider({ data, children }: { data: AppData; children: React.ReactNode }) {
  return (
    <DataContext value={data}>
      <FateClient client={data.fate}>{children}</FateClient>
    </DataContext>
  );
}
