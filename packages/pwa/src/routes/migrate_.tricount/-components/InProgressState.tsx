import { Trans } from "@lingui/react/macro";

export function InProgressState({ name, progress }: { name: string; progress: number }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Migration in progress</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-accent-700 dark:text-accent-200">{name}</p>

        <Progress value={progress} />
        <p className="mt-4 text-xs">
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
        className="absolute left-0 top-0 h-2 rounded-full bg-accent-500 dark:bg-accent-400"
        style={{ width: `${value * 100}%` }}
      />
      <div className="h-2 w-full rounded-full bg-accent-200 dark:bg-accent-800" />
    </div>
  );
}
