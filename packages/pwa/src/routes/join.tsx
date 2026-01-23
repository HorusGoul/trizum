import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { CardButton } from "#src/components/CardButton.js";
import { parseQRCodeForPartyId } from "#src/lib/qr.js";
import { RouteQRScanner } from "#src/components/RouteQRScanner.js";
import { useRouteQRScanner } from "#src/components/useRouteQRScanner.js";
import { Button } from "#src/ui/Button.js";
import { Icon } from "#src/ui/Icon.js";
import { AppTextField } from "#src/ui/TextField.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useId } from "react";
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

  function validateQRCode(value: string) {
    const partyId = parseQRCodeForPartyId(value);
    if (!partyId) {
      return t`Not a valid trizum party code`;
    }
    return true as const;
  }

  function handleScan(value: string) {
    const partyId = parseQRCodeForPartyId(value);

    // At this point validation already passed, partyId should exist
    if (!partyId) return;

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
        </div>

        {/* Primary action: Scan QR code */}
        <div className="container mt-4 px-4">
          <CardButton onPress={openScanner}>
            <Icon
              name="#lucide/scan-qr-code"
              size={24}
              className="text-accent-600 dark:text-accent-400"
            />
            <div className="flex flex-1 flex-col">
              <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">
                <Trans>Scan QR code</Trans>
              </span>
              <span className="text-sm text-accent-600 dark:text-accent-400">
                <Trans>Use your camera to scan a trizum invite</Trans>
              </span>
            </div>
          </CardButton>
        </div>

        {/* Divider */}
        <div className="container mt-6 flex items-center gap-4 px-4">
          <div className="h-px flex-1 bg-accent-200 dark:bg-accent-800" />
          <span className="text-sm text-accent-500">
            <Trans>or enter code</Trans>
          </span>
          <div className="h-px flex-1 bg-accent-200 dark:bg-accent-800" />
        </div>

        {/* Secondary action: Manual entry */}
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="container mt-6 flex flex-col gap-4 px-4"
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

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                color="accent"
                type="submit"
                isDisabled={!canSubmit || isSubmitting}
                className="gap-2"
              >
                <Trans>Join</Trans>
              </Button>
            )}
          </form.Subscribe>
        </form>
      </div>

      <RouteQRScanner
        isOpen={isOpen}
        onScan={handleScan}
        onClose={closeScanner}
        validate={validateQRCode}
      />
    </>
  );
}
