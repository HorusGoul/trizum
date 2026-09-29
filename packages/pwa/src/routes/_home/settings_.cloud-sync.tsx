import { createFileRoute } from "@tanstack/react-router";
import {
  CloudSyncSettingsView,
  type CloudSyncSearchParams,
} from "#src/components/CloudSyncSettingsView.tsx";
import { parseAuthReturnTo } from "#src/lib/authReturnTo.ts";

export const Route = createFileRoute("/_home/settings_/cloud-sync")({
  validateSearch: (search: Record<string, unknown>): CloudSyncSearchParams => ({
    auth: search.auth === "success" ? ("success" as const) : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    returnTo: parseAuthReturnTo(search.returnTo),
  }),
  component: CloudSyncSettings,
});

function CloudSyncSettings() {
  return <CloudSyncSettingsView search={Route.useSearch()} />;
}
