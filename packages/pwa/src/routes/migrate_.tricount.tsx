import { BackButton } from "#src/components/BackButton.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { AppTextField } from "#src/ui/TextField.tsx";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { startTransition, Suspense, useId, useState } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import type { Party } from "#src/models/party.ts";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import { getPartyHelpers } from "#src/hooks/useParty.ts";
import { useMediaFileActions } from "#src/hooks/useMediaFileActions.ts";
import type { MediaFile } from "#src/models/media.ts";
import { compressionPresets } from "#src/lib/imageCompression.ts";
import { Button } from "#src/ui/Button.tsx";
import type { MigrationData } from "#src/models/migration.ts";

export const Route = createFileRoute("/migrate_/tricount")({
  component: RouteComponent,
});

function RouteComponent() {
  const [state, migrate] = useMigrateTricount();

  switch (state.type) {
    case "idle":
      return <IdleState onSubmit={migrate} />;
    case "in-progress":
      return <InProgressState {...state} />;
    case "success":
      return <SuccessState {...state} />;
    case "error":
      return <ErrorState {...state} />;
  }
}

function validateTricountKey(value: string) {
  if (!value) {
    return t`Tricount key is required`;
  }
  return undefined;
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
      partyId: string;
    }
  | {
      type: "error";
      message: string;
    };

function useMigrateTricount() {
  const [state, setState] = useState<MigrationState>({ type: "idle" });
  const repo = useRepo();
  const { createMediaFile } = useMediaFileActions();

  async function migrate(key: string) {
    setState({
      type: "in-progress",
      name: t`Importing Tricount data...`,
      progress: 0,
    });

    try {
      const response = await fetch(`/api/migrate?key=${key}`);
      const data = (await response.json()) as MigrationData;

      const handle = repo.create<Party>({
        id: "" as DocumentId,
        name: data.party.name,
        description: data.party.description,
        currency: data.party.currency,
        participants: data.party.participants,
        chunkRefs: [],
      });
      handle.change((doc) => (doc.id = handle.documentId));

      // Import photos
      const photoMap = new Map<string, MediaFile["id"]>();
      try {
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const [mediaFileId] = await createMediaFile(
            blob,
            {},
            compressionPresets.balanced,
          );
          photoMap.set(photo.id, mediaFileId);

          setState({
            type: "in-progress",
            name: t`Importing attachments (${i + 1} of ${data.photos.length})`,
            progress: (i + 1) / data.photos.length,
          });
        }
      } catch (error) {
        console.error(error);
        throw new Error(
          `Error importing photos: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      const helpers = getPartyHelpers(repo, handle);

      // Expenses from oldest to newest
      data.expenses.sort(
        (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
      );

      for (let i = 0; i < data.expenses.length; i++) {
        const expense = data.expenses[i];

        await helpers
          .addExpenseToParty({
            name: expense.name,
            paidAt: new Date(expense.paidAt),
            shares: expense.shares,
            paidBy: expense.paidBy,
            photos: expense.photos
              .map((photoId) => photoMap.get(photoId))
              .filter((photoId): photoId is MediaFile["id"] => !!photoId),
          })
          .catch((error) => {
            console.error(error);
            throw new Error(
              `Error importing expense ${expense.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          });

        setState({
          type: "in-progress",
          name: t`Imported ${expense.name} (${i + 1} of ${data.expenses.length})`,
          progress: (i + 1) / data.expenses.length,
        });
      }

      setState({ type: "success", partyId: handle.documentId });
    } catch (error) {
      setState({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return [state, migrate] as const;
}

function IdleState({ onSubmit }: { onSubmit: (key: string) => void }) {
  const form = useForm({
    defaultValues: {
      key: "",
    },
    onSubmit: ({ value }) => {
      onSubmit(value.key);
    },
  });
  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="pl-4 text-2xl font-bold">
          <Trans>Migrate from Tricount</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) =>
            canSubmit ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="#lucide/check"
                  aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                  type="submit"
                  form={formId}
                  isDisabled={isSubmitting}
                />
              </Suspense>
            ) : null
          }
        </form.Subscribe>
      </div>

      <div className="h-2" />

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field
          name="key"
          validators={{ onChange: ({ value }) => validateTricountKey(value) }}
        >
          {(field) => (
            <AppTextField
              label={t`Tricount key`}
              description={t`Enter the key of the Tricount account you want to migrate from`}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>
      </form>
    </div>
  );
}

function InProgressState({
  name,
  progress,
}: {
  name: string;
  progress: number;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="text-2xl font-bold">
          <Trans>Migration in progress</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-accent-700 dark:text-accent-200">
          <Trans>{name}</Trans>
        </p>

        <Progress value={progress} />
        <p className="mt-4 text-xs">
          <Trans>Please don't close the app while we migrate your data</Trans>
        </p>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="relative w-full">
      <div
        className="absolute left-0 top-0 h-2 rounded-full bg-accent-500 dark:bg-accent-400"
        style={{ width: `${value * 100}%` }}
      />
      <div className="h-2 w-full rounded-full bg-accent-200 dark:bg-accent-800" />
    </div>
  );
}

function SuccessState({ partyId }: { partyId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="mb-4 text-2xl font-bold">
          <Trans>Migration successful</Trans>
        </h1>

        <Button
          color="input-like"
          onClick={() => {
            navigate({ to: `/party/${partyId}`, replace: true });
          }}
          className="font-bold"
        >
          <Trans>View party</Trans>
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="mb-4 text-2xl font-bold">
          <Trans>Something went wrong</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-accent-700 dark:text-accent-200">
          <Trans>{message}</Trans>
        </p>
        <Button
          color="input-like"
          onClick={() => {
            navigate({ to: `/`, replace: true });
          }}
          className="font-bold"
        >
          <Trans>Go back to home</Trans>
        </Button>
      </div>
    </div>
  );
}
