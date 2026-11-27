import { Trans } from "@lingui/react/macro";
import { BackButton } from "#src/components/BackButton.js";
import { createFileRoute } from "@tanstack/react-router";
import { AboutLink } from "./-components/AboutLink.js";
import { Contributor } from "./-components/Contributor.js";
import { FeatureItem } from "./-components/FeatureItem.js";
import { useState } from "react";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  const version = import.meta.env.VITE_APP_VERSION;
  const commit = import.meta.env.VITE_APP_COMMIT;
  const [currentYear] = useState(() => new Date().getFullYear());

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
            <h2 className="text-4xl font-bold text-neutral-950 dark:text-neutral-50">trizum</h2>
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <p>
                <Trans>Version</Trans> {version}
              </p>
              {commit !== "unknown" && (
                <a
                  href={`https://github.com/HorusGoul/trizum/commit/${commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-visible:ring-accent-500 dark:focus-visible:ring-accent-400 rounded-lg bg-neutral-950/5 px-1.5 pt-1 pb-0.5 font-mono leading-none text-neutral-700 outline-hidden hover:bg-neutral-950/10 hover:text-neutral-950 focus-visible:ring-2 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-neutral-50"
                >
                  {commit}
                </a>
              )}
            </div>
          </div>

          <p className="text-center text-lg text-neutral-600 dark:text-neutral-400">
            <Trans>
              Split bills with friends and family. Track, calculate, and settle expenses together.
            </Trans>
          </p>
        </section>

        {/* Features Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
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
          <h3 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
            <Trans>Links</Trans>
          </h3>
          <div className="shadow-surface flex flex-col divide-y divide-neutral-950/5 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-neutral-900">
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
            <AboutLink
              href="/terms"
              icon="lucide.scroll-text"
              label={<Trans comment="Link to the legal terms page">Terms of Service</Trans>}
              isInternal
            />
          </div>
        </section>

        {/* Contributors Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
            <Trans>Contributors</Trans>
          </h3>
          <div className="shadow-surface flex flex-col divide-y divide-neutral-950/5 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-neutral-900">
            <Contributor username="HorusGoul" website="https://horus.dev" />
            <Contributor username="marionauta" />
          </div>
        </section>

        {/* Credits Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
            <Trans>Credits</Trans>
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            <Trans>This project uses various open source libraries and tools.</Trans>
          </p>
          <div className="shadow-surface flex flex-col divide-y divide-neutral-950/5 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-neutral-900">
            <AboutLink
              href="/about/third-party-licenses"
              icon="lucide.book-open"
              label={<Trans>View Third-Party Licenses</Trans>}
              isInternal
            />
          </div>
        </section>

        {/* Footer */}
        <section className="mt-8 pt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          <p>
            <Trans>© {currentYear} trizum</Trans>
          </p>
        </section>
      </div>
    </div>
  );
}
