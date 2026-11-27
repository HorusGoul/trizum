import { Trans } from "@lingui/react/macro";

export function InProgressState({ name, progress }: { name: string; progress: number }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Migration in progress</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-neutral-950 dark:text-neutral-50">{name}</p>

        <Progress value={progress} />
        <p className="mt-4 text-xs text-neutral-600 dark:text-neutral-400">
          <Trans>Please don&apos;t close the app while we migrate your data</Trans>
        </p>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="relative w-full">
      <div
        className="bg-accent-500 dark:bg-accent-400 absolute top-0 left-0 h-2 rounded-full"
        style={{ width: `${value * 100}%` }}
      />
      <div className="h-2 w-full rounded-full bg-neutral-950/10 dark:bg-white/15" />
    </div>
  );
}
