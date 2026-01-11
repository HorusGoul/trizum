import { BackButton } from "#src/components/BackButton.js";
import { IconWithFallback, type IconProps } from "#src/ui/Icon.js";
import { Trans } from "@lingui/macro";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/support")({
  component: Support,
});

function Support() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium text-accent-900 dark:text-accent-100">
          <Trans>Support</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-8 px-4 py-6">
        {/* Header Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-800">
              <IconWithFallback
                name="#lucide/circle-help"
                size={32}
                className="text-accent-700 dark:text-accent-300"
              />
            </div>
            <p className="text-lg text-accent-700 dark:text-accent-300">
              <Trans>
                Need help with trizum? We&apos;re here to assist you.
              </Trans>
            </p>
          </div>
        </section>

        {/* Contact Options */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Contact Us</Trans>
          </h2>
          <div className="flex flex-col gap-3">
            <SupportLink
              href="mailto:contact@trizum.app"
              icon="#lucide/mail"
              title={<Trans>Email Support</Trans>}
              description={
                <Trans>
                  Send us an email and we&apos;ll get back to you as soon as
                  possible.
                </Trans>
              }
              linkText="contact@trizum.app"
            />
          </div>
        </section>

        {/* Report Issues */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Report Issues</Trans>
          </h2>
          <div className="flex flex-col gap-3">
            <SupportLink
              href="https://github.com/HorusGoul/trizum/issues"
              icon="#lucide/bug"
              title={<Trans>Bug Reports</Trans>}
              description={
                <Trans>
                  Found a bug? Let us know on GitHub and we&apos;ll fix it.
                </Trans>
              }
              linkText={<Trans>Open GitHub Issues</Trans>}
              isExternal
            />
            <SupportLink
              href="https://github.com/HorusGoul/trizum/issues/new"
              icon="#lucide/lightbulb"
              title={<Trans>Feature Requests</Trans>}
              description={
                <Trans>
                  Have an idea to improve trizum? We&apos;d love to hear it.
                </Trans>
              }
              linkText={<Trans>Submit a Request</Trans>}
              isExternal
            />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
            <Trans>Frequently Asked Questions</Trans>
          </h2>
          <div className="flex flex-col gap-4">
            <FAQItem
              question={<Trans>How does offline sync work?</Trans>}
              answer={
                <Trans>
                  trizum stores all your data locally on your device. When
                  you&apos;re online and share a group with others, changes sync
                  automatically across all devices in real-time.
                </Trans>
              }
            />
            <FAQItem
              question={<Trans>Is my data secure?</Trans>}
              answer={
                <Trans>
                  Your data is stored locally on your device and synced to
                  trizum servers for collaboration. Data is encrypted during
                  transmission. Groups are shared via links - anyone with the
                  link can access the group. See our Privacy Policy for details.
                </Trans>
              }
            />
            <FAQItem
              question={<Trans>Can I use trizum without an account?</Trans>}
              answer={
                <Trans>
                  Absolutely! trizum works without requiring any account or
                  sign-up. Just create a group and start tracking expenses.
                </Trans>
              }
            />
          </div>
        </section>

        {/* Footer */}
        <section className="mt-8 border-t border-accent-200 pt-6 text-center text-sm text-accent-600 dark:border-accent-800 dark:text-accent-400">
          <p>
            <Trans>
              Thank you for using trizum. Your feedback helps us improve!
            </Trans>
          </p>
        </section>
      </div>
    </div>
  );
}

interface SupportLinkProps {
  href: string;
  icon: IconProps["name"];
  title: React.ReactNode;
  description: React.ReactNode;
  linkText: React.ReactNode;
  isExternal?: boolean;
}

function SupportLink({
  href,
  icon,
  title,
  description,
  linkText,
  isExternal,
}: SupportLinkProps) {
  const linkProps = isExternal
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <a
      href={href}
      {...linkProps}
      className="flex gap-4 rounded-lg bg-accent-50 p-4 outline-none transition-colors hover:bg-accent-100 focus-visible:ring-2 focus-visible:ring-accent-500 dark:bg-accent-900 dark:hover:bg-accent-800"
    >
      <div className="flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-200 dark:bg-accent-700">
          <IconWithFallback
            name={icon}
            size={24}
            className="text-accent-700 dark:text-accent-300"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="font-semibold text-accent-900 dark:text-accent-100">
          {title}
        </h3>
        <p className="text-sm text-accent-600 dark:text-accent-400">
          {description}
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-700 dark:text-accent-300">
          {linkText}
          {isExternal && (
            <IconWithFallback
              name="#lucide/external-link"
              size={14}
              className="text-accent-500"
            />
          )}
        </span>
      </div>
    </a>
  );
}

interface FAQItemProps {
  question: React.ReactNode;
  answer: React.ReactNode;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="rounded-lg bg-accent-50 p-4 dark:bg-accent-900">
      <h3 className="font-semibold text-accent-900 dark:text-accent-100">
        {question}
      </h3>
      <p className="mt-2 text-sm text-accent-600 dark:text-accent-400">
        {answer}
      </p>
    </div>
  );
}
