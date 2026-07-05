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
        <div className="text-accent-600 dark:text-accent-400">
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
          <p className="text-accent-600 dark:text-accent-400 text-center text-sm">
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
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            This application uses the following open source libraries and tools. Below are their
            licenses and attributions.
          </Trans>
        </p>

        <pre className="bg-accent-50 text-accent-900 dark:bg-accent-900 dark:text-accent-100 overflow-x-auto rounded-lg p-4 text-xs leading-relaxed break-words whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    </div>
  );
}
