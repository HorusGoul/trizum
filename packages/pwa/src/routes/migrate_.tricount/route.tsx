import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { createPartyFromMigrationData } from "#src/models/migration.ts";
import { trizumApiClient } from "#src/lib/trizumApiClient.ts";
import type { Party } from "#src/models/party.ts";
import { ErrorState, SuccessState } from "./-components/FinishedStates.js";
import { IdleState } from "./-components/IdleState.js";
import { InProgressState } from "./-components/InProgressState.js";
import type { MigrateParams } from "./-components/types.js";

export const Route = createFileRoute("/migrate_/tricount")({
  component: RouteComponent,
});

function RouteComponent() {
  const [state, migrate] = useMigrateTricount();

  switch (state.type) {
    case "idle":
      return <IdleState onSubmit={(values) => void migrate(values)} />;
    case "in-progress":
      return <InProgressState {...state} />;
    case "success":
      return <SuccessState {...state} />;
    case "error":
      return <ErrorState {...state} />;
  }
}

type MigrationState =
  | {
      type: "idle";
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
      message: string;
    };

function useMigrateTricount() {
  const [state, setState] = useState<MigrationState>({ type: "idle" });
  const repo = useRepo();

  async function migrate({ key, importAttachments }: MigrateParams) {
    setState({
      type: "in-progress",
      name: t`Importing Tricount data...`,
      progress: 0,
    });

    try {
      const data = await trizumApiClient.migration.importTricount(key);

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

      setState({ type: "success", partyId });
    } catch (error) {
      setState({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return [state, migrate] as const;
}
