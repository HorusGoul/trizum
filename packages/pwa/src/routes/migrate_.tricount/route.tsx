import { trackEvent } from "#src/lib/analytics.ts";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useId } from "react";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";
import type { ImportProgressEntity } from "#src/lib/data/entities.ts";
import { mutationResult } from "#src/lib/data/mutationResult.ts";
import { MigrationApiError, trizumApiClient } from "#src/lib/trizumApiClient.ts";
import type { Party } from "#src/models/party.ts";
import { ErrorState, SuccessState } from "./-components/FinishedStates.js";
import { IdleState } from "./-components/IdleState.js";
import { InProgressState } from "./-components/InProgressState.js";
import type { MigrateParams } from "./-components/types.js";

const ProgressView = view<ImportProgressEntity>()({ name: true, progress: true });

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
  const client = useFateClient();
  const operationId = useId();

  const progress = useView(
    ProgressView,
    client.ref<ImportProgressEntity>("ImportProgress", operationId, ProgressView),
  );

  async function migrate({ key, importAttachments }: MigrateParams) {
    trackEvent("tricount_import_started");
    setState({
      type: "in-progress",
      name: t`Importing Tricount data...`,
      progress: 0,
    });

    try {
      const data = await trizumApiClient.migration.importTricount(key);

      const partyId = await mutationResult(
        client.mutations.party.import({ input: { data, importAttachments, operationId } }),
      );

      trackEvent("tricount_import_completed");
      setState({ type: "success", partyId });
    } catch (error) {
      trackEvent("tricount_import_failed");
      setState({
        type: "error",
        message:
          error instanceof MigrationApiError && error.status === "invalid_response"
            ? t`Tricount import returned an invalid response.`
            : error instanceof Error
              ? error.message
              : "Unknown error",
      });
    }
  }

  const displayedState =
    state.type === "in-progress" && progress.name ? { ...state, ...progress } : state;

  return [displayedState, migrate] as const;
}
