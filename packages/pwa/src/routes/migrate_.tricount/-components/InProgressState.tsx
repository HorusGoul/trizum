import { Trans } from "@lingui/react/macro";

export function InProgressState({ name, progress }: { name: string; progress: number }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm p-4 text-center">
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Migration in progress</Trans>
        </h1>
        <p className="my-4 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{name}</p>

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
        className="absolute top-0 left-0 h-2 rounded-full bg-neutral-500 dark:bg-neutral-400"
        style={{ width: `${value * 100}%` }}
      />
      <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
