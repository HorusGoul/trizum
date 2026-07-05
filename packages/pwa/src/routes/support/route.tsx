import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackButton } from "#src/components/BackButton.js";
import { Icon } from "#src/ui/Icon.js";
import { createFileRoute } from "@tanstack/react-router";
import { FAQItem } from "./-components/FAQItem.js";
import { SupportLink } from "./-components/SupportLink.js";

export const Route = createFileRoute("/support")({
  component: Support,
});

function Support() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="text-accent-900 dark:text-accent-100 max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Support</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-8 px-4 py-6">
        {/* Header Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="bg-accent-100 dark:bg-accent-800 flex h-16 w-16 items-center justify-center rounded-full">
              <Icon
                icon="lucide.circle-help"
                width={32}
                height={32}
                className="text-accent-700 dark:text-accent-300"
              />
            </div>
            <p className="text-accent-700 dark:text-accent-300 text-lg">
              <Trans>Need help with trizum? We&apos;re here to assist you.</Trans>
            </p>
          </div>
        </section>

        {/* Contact Options */}
        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Contact Us</Trans>
          </h2>
          <div className="flex flex-col gap-3">
            <SupportLink
              href="mailto:contact@trizum.app"
              icon="lucide.mail"
              title={t`Email Support`}
              description={t`Send us an email and we'll get back to you as soon as possible.`}
              linkText="contact@trizum.app"
            />
          </div>
        </section>

        {/* Report Issues */}
        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Report Issues</Trans>
          </h2>
          <div className="flex flex-col gap-3">
            <SupportLink
              href="https://github.com/HorusGoul/trizum/issues"
              icon="lucide.bug"
              title={t`Bug Reports`}
              description={t`Found a bug? Let us know on GitHub and we'll fix it.`}
              linkText={t`Open GitHub Issues`}
              isExternal
            />
            <SupportLink
              href="https://github.com/HorusGoul/trizum/issues/new"
              icon="lucide.lightbulb"
              title={t`Feature Requests`}
              description={t`Have an idea to improve trizum? We'd love to hear it.`}
              linkText={t`Submit a Request`}
              isExternal
            />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>Frequently Asked Questions</Trans>
          </h2>
          <div className="flex flex-col gap-4">
            <FAQItem
              question={t`How does offline sync work?`}
              answer={t`trizum stores all your data locally on your device. When you're online and share a group with others, changes sync automatically across all devices in real-time.`}
            />
            <FAQItem
              question={t`Is my data secure?`}
              answer={t`Your data is stored locally on your device and synced to trizum servers for collaboration. Data is encrypted during transmission. Groups are shared via links - anyone with the link can access the group. See our Privacy Policy for details.`}
            />
            <FAQItem
              question={t`Can I use trizum without an account?`}
              answer={t`Absolutely! trizum works without requiring any account or sign-up. Just create a group and start tracking expenses.`}
            />
          </div>
        </section>

        {/* Footer */}
        <section className="border-accent-200 text-accent-600 dark:border-accent-800 dark:text-accent-400 mt-8 border-t pt-6 text-center text-sm">
          <p>
            <Trans>Thank you for using trizum. Your feedback helps us improve!</Trans>
          </p>
        </section>
      </div>
    </div>
  );
}
