import { BackButton } from "#src/components/BackButton.js";
import { IconWithFallback, type IconProps } from "#src/ui/Icon.js";
import { Trans } from "@lingui/macro";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  const version = import.meta.env.VITE_APP_VERSION;
  const commit = import.meta.env.VITE_APP_COMMIT;

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="pl-4 text-2xl font-bold">
          <Trans>About</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-8 px-4 py-6">
        {/* App Info Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-4xl font-bold text-accent-900 dark:text-accent-100">
              trizum
            </h2>
            <div className="flex items-center justify-center gap-2 text-sm text-accent-600 dark:text-accent-400">
              <p>
                <Trans>Version</Trans> {version}
              </p>
              {commit !== "unknown" && (
                <a
                  href={`https://github.com/HorusGoul/trizum/commit/${commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-accent-100 px-1 pt-1 font-mono leading-none text-accent-700 hover:bg-accent-200 hover:text-accent-900 dark:bg-accent-800 dark:text-accent-300 dark:hover:bg-accent-700 dark:hover:text-accent-100"
                >
                  {commit}
                </a>
              )}
            </div>
          </div>

          <p className="text-center text-lg text-accent-700 dark:text-accent-300">
            <Trans>
              Split bills with friends and family. Track, calculate, and settle
              expenses together.
            </Trans>
          </p>
        </section>

        {/* Features Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Features</Trans>
          </h3>
          <ul className="flex flex-col gap-3">
            <FeatureItem
              icon="#lucide/wifi-off"
              title={<Trans>Offline-First</Trans>}
              description={
                <Trans>
                  Works seamlessly offline with automatic sync when online
                </Trans>
              }
            />
            <FeatureItem
              icon="#lucide/refresh-cw"
              title={<Trans>Real-Time Sync</Trans>}
              description={
                <Trans>
                  Changes sync automatically across all your devices
                </Trans>
              }
            />
            <FeatureItem
              icon="#lucide/users"
              title={<Trans>Multi-Party Splitting</Trans>}
              description={
                <Trans>Split expenses fairly among multiple participants</Trans>
              }
            />
          </ul>
        </section>

        {/* Links Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Links</Trans>
          </h3>
          <div className="flex flex-col gap-3">
            <AboutLink
              href="https://github.com/HorusGoul/trizum"
              icon="#lucide/github"
              label={<Trans>View on GitHub</Trans>}
            />
            <AboutLink
              href="https://github.com/HorusGoul/trizum/issues"
              icon="#lucide/bug"
              label={<Trans>Report an Issue</Trans>}
            />
            <AboutLink
              href="https://github.com/HorusGoul/trizum/blob/main/LICENSE"
              icon="#lucide/scale"
              label={<Trans>License</Trans>}
            />
            <AboutLink
              href="/support"
              icon="#lucide/circle-help"
              label={<Trans>Support</Trans>}
              isInternal
            />
            <AboutLink
              href="/privacy-policy"
              icon="#lucide/shield"
              label={<Trans>Privacy Policy</Trans>}
              isInternal
            />
          </div>
        </section>

        {/* Contributors Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Contributors</Trans>
          </h3>
          <div className="flex flex-col gap-3">
            <Contributor username="HorusGoul" website="https://horus.dev" />
            <Contributor username="marionauta" />
          </div>
        </section>

        {/* Credits Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Credits</Trans>
          </h3>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              This project uses various open source libraries and tools.
            </Trans>
          </p>
          <AboutLink
            href="/about/third-party-licenses"
            icon="#lucide/book-open"
            label={<Trans>View Third-Party Licenses</Trans>}
            isInternal
          />
        </section>

        {/* Footer */}
        <section className="mt-8 border-t border-accent-200 pt-6 text-center text-sm text-accent-600 dark:border-accent-800 dark:text-accent-400">
          <p>
            <Trans>© {new Date().getFullYear()} trizum</Trans>
          </p>
        </section>
      </div>
    </div>
  );
}

interface FeatureItemProps {
  icon: IconProps["name"];
  title: React.ReactNode;
  description: React.ReactNode;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-800">
          <IconWithFallback
            name={icon}
            size={20}
            className="text-accent-700 dark:text-accent-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold text-accent-900 dark:text-accent-100">
          {title}
        </h4>
        <p className="text-sm text-accent-600 dark:text-accent-400">
          {description}
        </p>
      </div>
    </li>
  );
}

interface ContributorProps {
  username: string;
  website?: string;
}

function Contributor({ username, website }: ContributorProps) {
  const href = website || `https://github.com/${username}`;
  const avatarUrl = `https://github.com/${username}.png`;

  return (
    <AboutLink
      href={href}
      label={
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl}
            alt={`@${username}`}
            className="h-8 w-8 rounded-full"
            loading="lazy"
          />
          <span>@{username}</span>
        </div>
      }
    />
  );
}

interface AboutLinkProps {
  href: string;
  icon?: IconProps["name"];
  label: React.ReactNode;
  isInternal?: boolean;
}

function AboutLink({ href, icon, label, isInternal }: AboutLinkProps) {
  const className =
    "flex items-center gap-3 rounded-lg bg-accent-50 px-4 py-3 text-accent-900 outline-none transition-colors hover:bg-accent-100 focus-visible:ring-2 focus-visible:ring-accent-500 dark:bg-accent-900 dark:text-accent-100 dark:hover:bg-accent-800";

  const content = (
    <>
      {icon && <IconWithFallback name={icon} size={20} />}
      <span className="flex-1">{label}</span>
      {!isInternal && (
        <IconWithFallback
          name="#lucide/external-link"
          size={16}
          className="text-accent-600 dark:text-accent-400"
        />
      )}
    </>
  );

  if (isInternal) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  );
}
