import { Trans } from "@lingui/react/macro";
import { BackButton } from "#src/components/BackButton.js";
import { createFileRoute } from "@tanstack/react-router";
import { AboutLink } from "./-components/AboutLink.js";
import { Contributor } from "./-components/Contributor.js";
import { FeatureItem } from "./-components/FeatureItem.js";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  const version = import.meta.env.VITE_APP_VERSION;
  const commit = import.meta.env.VITE_APP_COMMIT;
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>About</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-8 px-4 py-6">
        {/* App Info Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-accent-900 dark:text-accent-100 text-4xl font-bold">trizum</h2>
            <div className="text-accent-600 dark:text-accent-400 flex items-center justify-center gap-2 text-sm">
              <p>
                <Trans>Version</Trans> {version}
              </p>
              {commit !== "unknown" && (
                <a
                  href={`https://github.com/HorusGoul/trizum/commit/${commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-accent-100 text-accent-700 hover:bg-accent-200 hover:text-accent-900 dark:bg-accent-800 dark:text-accent-300 dark:hover:bg-accent-700 dark:hover:text-accent-100 rounded-sm px-1 pt-1 font-mono leading-none"
                >
                  {commit}
                </a>
              )}
            </div>
          </div>

          <p className="text-accent-700 dark:text-accent-300 text-center text-lg">
            <Trans>
              Split bills with friends and family. Track, calculate, and settle expenses together.
            </Trans>
          </p>
        </section>

        {/* Features Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Features</Trans>
          </h3>
          <ul className="flex flex-col gap-3">
            <FeatureItem
              icon="lucide.wifi-off"
              title={<Trans>Offline-First</Trans>}
              description={<Trans>Works seamlessly offline with automatic sync when online</Trans>}
            />
            <FeatureItem
              icon="lucide.refresh-cw"
              title={<Trans>Real-Time Sync</Trans>}
              description={<Trans>Changes sync automatically across all your devices</Trans>}
            />
            <FeatureItem
              icon="lucide.users"
              title={<Trans>Multi-Party Splitting</Trans>}
              description={<Trans>Split expenses fairly among multiple participants</Trans>}
            />
          </ul>
        </section>

        {/* Links Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Links</Trans>
          </h3>
          <div className="flex flex-col gap-3">
            <AboutLink
              href="https://github.com/HorusGoul/trizum"
              icon="brand.github"
              label={<Trans>View on GitHub</Trans>}
            />
            <AboutLink
              href="https://github.com/HorusGoul/trizum/issues"
              icon="lucide.bug"
              label={<Trans>Report an Issue</Trans>}
            />
            <AboutLink
              href="https://github.com/HorusGoul/trizum/blob/main/LICENSE"
              icon="lucide.scale"
              label={<Trans>License</Trans>}
            />
            <AboutLink
              href="/support"
              icon="lucide.circle-help"
              label={<Trans>Support</Trans>}
              isInternal
            />
            <AboutLink
              href="/privacy-policy"
              icon="lucide.shield"
              label={<Trans>Privacy Policy</Trans>}
              isInternal
            />
          </div>
        </section>

        {/* Contributors Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Contributors</Trans>
          </h3>
          <div className="flex flex-col gap-3">
            <Contributor username="HorusGoul" website="https://horus.dev" />
            <Contributor username="marionauta" />
          </div>
        </section>

        {/* Credits Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Credits</Trans>
          </h3>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>This project uses various open source libraries and tools.</Trans>
          </p>
          <AboutLink
            href="/about/third-party-licenses"
            icon="lucide.book-open"
            label={<Trans>View Third-Party Licenses</Trans>}
            isInternal
          />
        </section>

        {/* Footer */}
        <section className="border-accent-200 text-accent-600 dark:border-accent-800 dark:text-accent-400 mt-8 border-t pt-6 text-center text-sm">
          <p>
            <Trans>© {currentYear} trizum</Trans>
          </p>
        </section>
      </div>
    </div>
  );
}
