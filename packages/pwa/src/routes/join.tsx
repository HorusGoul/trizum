import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { parseQRCodeForPartyId } from "#src/lib/qr.js";
import { RouteQRScanner } from "#src/components/RouteQRScanner.js";
import { useRouteQRScanner } from "#src/components/useRouteQRScanner.js";
import { Button } from "#src/ui/Button.js";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { toast } from "sonner";

interface JoinSearchParams {
  scanning?: boolean;
}

export const Route = createFileRoute("/join")({
  component: Join,
  validateSearch: (search: Record<string, unknown>): JoinSearchParams => ({
    scanning: search.scanning === true || search.scanning === "true",
  }),
});

interface JoinFormValues {
  id: string;
}

function Join() {
  const router = useRouter();
  const navigate = useNavigate({ from: Route.fullPath });
  const { scanning } = Route.useSearch();

  const { isOpen, openScanner, closeScanner } = useRouteQRScanner({
    scanning,
    navigate: ({ search, replace }) => {
      void navigate({ search: (prev) => ({ ...prev, ...search }), replace });
    },
    goBack: () => router.history.back(),
  });

  function handleScan(value: string) {
    const partyId = parseQRCodeForPartyId(value);

    if (!partyId) {
      toast.error(
        t`Invalid QR code. This doesn't appear to be a trizum party code.`,
      );
      closeScanner();
      return;
    }

    void navigate({
      to: "/party/$partyId",
      replace: true,
      params: { partyId },
      search: { tab: "expenses" },
    });
  }

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
    <>
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

        <div className="container mt-6 px-4">
          <Button color="input-like" onPress={openScanner} className="gap-2">
            <Icon name="#lucide/scan-qr-code" size={20} />
            <Trans>Scan QR code</Trans>
          </Button>
        </div>
      </div>

      <RouteQRScanner
        isOpen={isOpen}
        onScan={handleScan}
        onClose={closeScanner}
      />
    </>
  );
}
