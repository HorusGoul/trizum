import { BackButton } from "#src/components/BackButton.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/join")({
  component: Join,
});

interface JoinFormValues {
  id: string;
}

function Join() {
  const navigate = useNavigate();

  function validateId(id: string) {
    const isUrl = id.includes("/");
    const partyId = isUrl ? id.split("/party/")[1].split("/")[0] : id;
    const valid = isValidDocumentId(partyId);

    if (!valid) {
      return isUrl
        ? t`Invalid trizum party link`
        : t`Invalid trizum party code`;
    }
  }

  function onJoinParty(value: JoinFormValues) {
    let partyId: string;

    const isUrl = value.id.includes("/");

    if (isUrl) {
      partyId = value.id.split("/party/")[1].split("/")[0];
    } else {
      partyId = value.id;
    }

    if (!isValidDocumentId(partyId)) {
      toast.error(
        isUrl ? t`Invalid trizum party link` : t`Invalid trizum party code`,
      );
      return;
    }
    void navigate({
      to: "/party/$partyId",
      replace: true,
      params: {
        partyId,
      },
      search: {
        tab: "expenses",
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
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Join a trizum</Trans>
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
          name="id"
          validators={{
            onChange: ({ value }) => validateId(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Link or code`}
              description={t`Enter the link or code of the trizum party you want to join`}
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
