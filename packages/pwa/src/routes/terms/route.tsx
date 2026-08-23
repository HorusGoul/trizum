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

        <h1 className="text-accent-900 dark:text-accent-100 max-h-12 truncate px-4 text-xl font-medium">
          <Trans comment="Title of the legal terms page">Terms of Service</Trans>
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-6 px-4 py-6">
        <p className="text-accent-600 dark:text-accent-400 text-sm">
          <Trans>Last updated: July 27, 2026</Trans>
        </p>

        <p className="text-accent-700 dark:text-accent-300">
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
