import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { CardButton } from "#src/components/CardButton.js";
import { parseQRCodeForPartyId } from "#src/lib/qr.js";
import { RouteQRScanner } from "#src/components/RouteQRScanner.js";
import { useRouteQRScanner } from "#src/components/useRouteQRScanner.js";
import { Button } from "#src/ui/Button.js";
import { Icon } from "#src/ui/Icon.js";
import { AppTextField } from "#src/ui/fields/TextField.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
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

function validateQRCode(value: string) {
  const partyId = parseQRCodeForPartyId(value);
  if (!partyId) {
    return t`Not a valid trizum party code`;
  }
  return true as const;
}

function getPartyIdFromLinkOrCode(id: string) {
  const isUrl = id.includes("/");
  return isUrl ? id.split("/party/")[1].split("/")[0] : id;
}

function validateId(id: string) {
  const isUrl = id.includes("/");
  const partyId = getPartyIdFromLinkOrCode(id);
  const valid = isValidDocumentId(partyId);

  if (!valid) {
    return isUrl ? t`Invalid trizum party link` : t`Invalid trizum party code`;
  }
}

function Join() {
  const router = useRouter();
  const currentLocation = useLocation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { scanning } = Route.useSearch();

  const { isOpen, openScanner, closeScanner } = useRouteQRScanner({
    scanning,
    currentLocation,
    buildLocation: (options) => router.buildLocation({ ...options, from: Route.fullPath }),
    navigate: ({ search, replace }) => {
      void navigate({ search: (prev) => ({ ...prev, ...search }), replace });
    },
    history: router.history,
  });

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

  function onJoinParty(value: JoinFormValues) {
    const isUrl = value.id.includes("/");
    const partyId = getPartyIdFromLinkOrCode(value.id);

    if (!isValidDocumentId(partyId)) {
      toast.error(isUrl ? t`Invalid trizum party link` : t`Invalid trizum party code`);
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
        <div className="mt-safe container flex h-16 items-center px-2">
          <BackButton fallbackOptions={{ to: "/" }} />
          <h1 className="max-h-12 truncate px-4 text-xl font-medium">
            <Trans>Join a trizum</Trans>
          </h1>
        </div>

        {/* Primary action: Scan QR code */}
        <div className="container mt-4 px-4">
          <CardButton onPress={openScanner}>
            <Icon
              icon="lucide.scan-qr-code"
              width={24}
              height={24}
              className="text-accent-600 dark:text-accent-400"
            />
            <div className="flex flex-1 flex-col">
              <span className="text-accent-950 dark:text-accent-50 text-lg font-semibold">
                <Trans>Scan QR code</Trans>
              </span>
              <span className="text-accent-600 dark:text-accent-400 text-sm">
                <Trans>Use your camera to scan a trizum invite</Trans>
              </span>
            </div>
          </CardButton>
        </div>

        {/* Divider */}
        <div className="container mt-6 flex items-center gap-4 px-4">
          <div className="bg-accent-200 dark:bg-accent-800 h-px flex-1" />
          <span className="text-accent-500 text-sm">
            <Trans>or enter code</Trans>
          </span>
          <div className="bg-accent-200 dark:bg-accent-800 h-px flex-1" />
        </div>

        {/* Secondary action: Manual entry */}
        {/* eslint-disable-next-line react-doctor/no-prevent-default -- React form actions reset TanStack Form fields after validation failures. */}
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
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
                isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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
