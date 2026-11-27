import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { createFileRoute } from "@tanstack/react-router";

async function fetchLicenses(): Promise<string> {
  const response = await fetch("/THIRD-PARTY-LICENSES.txt");

  if (!response.ok) {
    throw new Error(t`Failed to load licenses`);
  }

  return response.text();
}

export const Route = createFileRoute("/about_/third-party-licenses")({
  component: ThirdPartyLicenses,
  loader: async () => {
    const content = await fetchLicenses();

    return { content };
  },
  pendingComponent: () => (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Third-Party Licenses</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
        <div className="text-neutral-600 dark:text-neutral-400">
          <Trans>Loading licenses...</Trans>
        </div>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Third-Party Licenses</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-danger-700 dark:text-danger-300 text-center">
          <Trans>Failed to load licenses. Please try again later.</Trans>
        </p>
        {error instanceof Error && (
          <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
            {error.message}
          </p>
        )}
      </div>
    </div>
  ),
});

function ThirdPartyLicenses() {
  const { content } = Route.useLoaderData();

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Third-Party Licenses</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-4 px-4">
        <p className="text-neutral-700 dark:text-neutral-300">
          <Trans>
            This application uses the following open source libraries and tools. Below are their
            licenses and attributions.
          </Trans>
        </p>

        <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed break-words whitespace-pre-wrap text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
          {content}
        </pre>
      </div>
    </div>
  );
}
