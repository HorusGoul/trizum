import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { Suspense, useId } from "react";
import { BackButton } from "#src/components/BackButton.tsx";
import { extractTricountId } from "#src/lib/tricount.ts";
import { Checkbox } from "#src/ui/Checkbox.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { AppTextField } from "#src/ui/fields/TextField.js";
import type { MigrateParams } from "./types.js";
import { validateTricountKey } from "./validation.js";

export function IdleState({ onSubmit }: { onSubmit: (values: MigrateParams) => void }) {
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
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Migrate from Tricount</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) =>
            canSubmit ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="lucide.check"
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

      {/* eslint-disable-next-line react-doctor/no-prevent-default -- React form actions reset TanStack Form fields after validation failures. */}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field name="key" validators={{ onChange: ({ value }) => validateTricountKey(value) }}>
          {(field) => (
            <AppTextField
              label={t`Tricount URL or key`}
              description={t`Paste the Tricount sharing message, URL (e.g., https://tricount.com/abc123), or the direct key`}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
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
