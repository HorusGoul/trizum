import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "#src/ui/Button.tsx";

export function SuccessState({ partyId }: { partyId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
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

export function ErrorState({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Something went wrong</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-accent-700 dark:text-accent-200">{message}</p>
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
