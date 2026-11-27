import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { appWorker } from "#src/lib/appWorker/client.ts";
import { Icon } from "@trizum/ui/Icon";
import { Button } from "@trizum/ui/Button";
import type { Party } from "#src/models/party.ts";

export function SuccessState({ partyId }: { partyId: Party["id"] }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Migration successful</Trans>
        </h1>

        <Button
          color="accent"
          pressAction={async () => {
            await appWorker.recalculateBalances(partyId);
            await navigate({ to: `/party/${partyId}`, replace: true });
          }}
          className="font-bold"
        >
          <Trans>View party</Trans>
        </Button>
      </div>
    </div>
  );
}

export function ErrorState({ onCheckLink }: { onCheckLink: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm px-4 py-8 text-center">
        <div className="shadow-surface mx-auto mb-5 flex size-13 items-center justify-center rounded-full bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          <Icon icon="lucide.unlink" />
        </div>
        <h1
          tabIndex={-1}
          ref={(element) => element?.focus()}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          <Trans>Couldn't import this tricount</Trans>
        </h1>
        <p className="my-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <Trans>
            Check that you copied the full sharing link from tricount. If the link is correct, try
            again later.
          </Trans>
        </p>
        <Button color="accent" onPress={onCheckLink} className="mb-2 font-semibold">
          <Trans>Check tricount link</Trans>
        </Button>
        <Button
          onPress={() => {
            void navigate({ to: `/`, replace: true });
          }}
          className="font-semibold"
        >
          <Trans>Go back to home</Trans>
        </Button>
        <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          <Trans>Your link and import options are kept so you can try again.</Trans>
        </p>
      </div>
    </div>
  );
}
