import { BackButton } from "#src/components/BackButton.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { AppTextField } from "#src/ui/TextField.tsx";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId, useState } from "react";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { Button } from "#src/ui/Button.tsx";
import {
  createPartyFromMigrationData,
  type MigrationData,
} from "#src/models/migration.ts";
import { Checkbox } from "#src/ui/Checkbox.tsx";
import { getAppLink } from "#src/lib/link.ts";

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

function extractTricountId(input: string): string | null {
  // Check if it's a tricount.com URL (standalone or within text)
  const urlMatch = input.match(
    /https?:\/\/(?:www\.)?tricount\.com\/([a-zA-Z0-9]+)/,
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check if it's already a direct key (alphanumeric string)
  const keyMatch = input.match(/^[a-zA-Z0-9]+$/);
  if (keyMatch) {
    return input;
  }

  return null;
}

function validateTricountKey(value: string) {
  if (!value) {
    return t`Tricount key or URL is required`;
  }

  const extractedId = extractTricountId(value);
  if (!extractedId) {
    return t`Please paste the Tricount sharing message, URL (e.g., https://tricount.com/abc123), or key`;
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

interface MigrateParams {
  key: string;
  importAttachments: boolean;
}

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
      const response = await fetch(getAppLink(`/api/migrate?key=${key}`));
      const data = (await response.json()) as MigrationData;

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

function IdleState({
  onSubmit,
}: {
  onSubmit: (values: { key: string; importAttachments: boolean }) => void;
}) {
  const form = useForm({
    defaultValues: {
      key: "",
      importAttachments: true,
    },
    onSubmit: ({ value }) => {
      const key = extractTricountId(value.key);
      if (!key) {
        throw new Error(t`Invalid tricount URL or key`);
      }

      onSubmit({
        key,
        importAttachments: value.importAttachments,
      });
    },
  });
  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
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
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field
          name="key"
          validators={{ onChange: ({ value }) => validateTricountKey(value) }}
        >
          {(field) => (
            <AppTextField
              label={t`Tricount URL or key`}
              description={t`Paste the Tricount sharing message, URL (e.g., https://tricount.com/abc123), or the direct key`}
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

        <form.Field name="importAttachments">
          {(field) => (
            <Checkbox
              name={field.name}
              isSelected={field.state.value}
              onChange={(isSelected) => {
                field.handleChange(isSelected);
              }}
            >
              {t`Import attachments`}
            </Checkbox>
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
          {name}
        </p>

        <Progress value={progress} />
        <p className="mt-4 text-xs">
          <Trans>
            Please don&apos;t close the app while we migrate your data
          </Trans>
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
            void navigate({ to: `/party/${partyId}`, replace: true });
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
          {message}
        </p>
        <Button
          color="input-like"
          onClick={() => {
            void navigate({ to: `/`, replace: true });
          }}
          className="font-bold"
        >
          <Trans>Go back to home</Trans>
        </Button>
      </div>
    </div>
  );
}
