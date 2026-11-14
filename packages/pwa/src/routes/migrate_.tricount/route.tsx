import { trackEvent } from "#src/lib/analytics.ts";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { createPartyFromMigrationData } from "#src/models/migration.ts";
import { trizumApiClient } from "#src/lib/trizumApiClient.ts";
import { extractTricountId } from "#src/lib/tricount.ts";
import type { Party } from "#src/models/party.ts";
import { ErrorState, SuccessState } from "./-components/FinishedStates.js";
import { IdleState } from "./-components/IdleState.js";
import { InProgressState } from "./-components/InProgressState.js";
import type { MigrateParams } from "./-components/types.js";

export const Route = createFileRoute("/migrate_/tricount")({
  component: RouteComponent,
});

function RouteComponent() {
  const [state, migrate, editLink] = useMigrateTricount();

  switch (state.type) {
    case "idle":
      return <IdleState defaultValues={state.values} onSubmit={(values) => void migrate(values)} />;
    case "in-progress":
      return <InProgressState {...state} />;
    case "success":
      return <SuccessState {...state} />;
    case "error":
      return <ErrorState onCheckLink={editLink} />;
  }
}

type MigrationState =
  | {
      type: "idle";
      values?: MigrateParams;
    }
  | {
      type: "in-progress";
      name: string;
      progress: number;
    }
  | {
      type: "success";
      partyId: Party["id"];
    }
  | {
      type: "error";
      values: MigrateParams;
    };

function useMigrateTricount() {
  const [state, setState] = useState<MigrationState>({ type: "idle" });
  const repo = useRepo();

  async function migrate(values: MigrateParams) {
    const { key, importAttachments } = values;
    const tricountKey = extractTricountId(key);

    if (!tricountKey) return;

    trackEvent("tricount_import_started");
    setState({
      type: "in-progress",
      name: t`Importing Tricount data...`,
      progress: 0,
    });

    try {
      const data = await trizumApiClient.migration.importTricount(tricountKey);

      const partyId = await createPartyFromMigrationData({
        repo,
        data,
        importAttachments,
        onProgress: (progress) => {
          setState({
            type: "in-progress",
            name: progress.name,
            progress: progress.progress,
          });
        },
      });

      trackEvent("tricount_import_completed");
      setState({ type: "success", partyId });
    } catch {
      trackEvent("tricount_import_failed");
      setState({
        type: "error",
        values,
      });
    }
  }

  function editLink() {
    if (state.type === "error") setState({ type: "idle", values: state.values });
  }

  return [state, migrate, editLink] as const;
}
