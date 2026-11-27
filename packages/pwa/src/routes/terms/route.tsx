import { BackButton } from "#src/components/BackButton.js";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { AccountAndUsageTerms } from "./-components/AccountAndUsageTerms.js";
import { LegalTerms } from "./-components/LegalTerms.js";
import { PremiumTerms } from "./-components/PremiumTerms.js";
import { ServiceTerms } from "./-components/ServiceTerms.js";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium text-neutral-900 dark:text-neutral-100">
          <Trans comment="Title of the legal terms page">Terms of Service</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-6 px-4 py-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <Trans>Last updated: July 27, 2026</Trans>
        </p>

        <p className="text-neutral-700 dark:text-neutral-300">
          <Trans>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of trizum,
            including its website, installed Progressive Web App, Android and iOS applications,
            synchronization services, and related features (collectively, the &quot;Service&quot;).
          </Trans>
        </p>

        <AccountAndUsageTerms />
        <PremiumTerms />
        <ServiceTerms />
        <LegalTerms />
      </div>
    </div>
  );
}
