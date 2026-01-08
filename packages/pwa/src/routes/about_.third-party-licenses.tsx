import { BackButton } from "#src/components/BackButton.js";
import { t, Trans } from "@lingui/macro";
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
        <p className="text-center text-danger-700 dark:text-danger-300">
          <Trans>Failed to load licenses. Please try again later.</Trans>
        </p>
        {error instanceof Error && (
          <p className="text-center text-sm text-accent-600 dark:text-accent-400">
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
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Third-Party Licenses</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-4 px-4">
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            This application uses the following open source libraries and tools.
            Below are their licenses and attributions.
          </Trans>
        </p>

        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-accent-50 p-4 text-xs leading-relaxed text-accent-900 dark:bg-accent-900 dark:text-accent-100">
          {content}
        </pre>
      </div>
    </div>
  );
}
