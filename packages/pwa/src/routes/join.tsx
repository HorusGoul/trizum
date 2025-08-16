import { BackButton } from "#src/components/BackButton.js";
import { validateDocumentId } from "#src/lib/validation.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { t } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";

export const Route = createFileRoute("/join")({
  component: Join,
});

interface JoinFormValues {
  id: string;
}

function Join() {
  const navigate = useNavigate();

  function onJoinParty(value: JoinFormValues) {
    if (!isValidDocumentId(value.id)) {
      console.warn(`Not a valid partyId: ${value.id}`);
      return;
    }
    navigate({
      to: "/party/$partyId",
      replace: true,
      params: {
        partyId: value.id,
      },
    });
  }

  const form = useForm({
    defaultValues: {
      id: "",
    },
    onSubmit: ({ value }) => {
      onJoinParty(value);
    },
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">Join a trizum</h1>
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
          name="id"
          validators={{
            onChange: ({ value }) => validateDocumentId(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`URL or Party ID`}
              minLength={1}
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
