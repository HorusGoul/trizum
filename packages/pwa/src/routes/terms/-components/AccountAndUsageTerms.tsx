import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";

export function AccountAndUsageTerms() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>1. Acceptance of These Terms</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            By accessing or using the Service, you agree to these Terms and our{" "}
            <Link
              to="/privacy-policy"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
            >
              Privacy Policy
            </Link>
            . If you do not agree, do not use the Service.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You must be at least 18 years old to use trizum. If you use the Service on behalf of an
            organization, you confirm that you have authority to accept these Terms for that
            organization.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>2. What trizum Does</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            trizum helps people record shared expenses, calculate balances, and coordinate
            settlements within groups. The Service is a record-keeping and calculation tool. It is
            not a bank, payment institution, financial adviser, accounting service, or debt
            collection service, and it does not hold or transfer money between participants.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You are responsible for checking expense entries, balances, exchange rates, and
            settlement instructions before relying on them or making a payment. trizum does not
            guarantee that information entered by you or another participant is accurate or
            complete.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>3. Accounts, Devices, and Group Access</Trans>
        </h2>
        <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
          <li>
            <Trans>
              You are responsible for keeping your account credentials, devices, and sign-in methods
              secure and for activity performed through your account.
            </Trans>
          </li>
          <li>
            <Trans>
              Group access is shared through links. Anyone with a valid group link may be able to
              access and change that group, so only share links with people you trust.
            </Trans>
          </li>
          <li>
            <Trans>
              You must provide accurate account information and promptly update it when it changes.
            </Trans>
          </li>
          <li>
            <Trans>
              You must notify us promptly if you believe your account, device, or a group link has
              been compromised.
            </Trans>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>4. Your Content and Responsibilities</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You retain ownership of information and files you add to the Service, including group
            details, participant information, expenses, descriptions, receipts, and images
            (&quot;User Content&quot;). You grant us a limited, worldwide, non-exclusive license to
            host, process, reproduce, and transmit User Content only as needed to operate, secure,
            support, and improve the Service.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You are responsible for User Content you add or share. You must have the necessary
            rights and permissions to use it, including permission to share personal information
            about other participants. Do not upload sensitive information that is unnecessary for
            splitting expenses.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>5. Acceptable Use</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>You may not use the Service to:</Trans>
        </p>
        <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
          <li>
            <Trans>Break the law or infringe another person&apos;s rights</Trans>
          </li>
          <li>
            <Trans>Harass, threaten, defraud, impersonate, or harm another person</Trans>
          </li>
          <li>
            <Trans>Upload malware or content designed to disrupt or damage the Service</Trans>
          </li>
          <li>
            <Trans>
              Probe, bypass, or interfere with security, access controls, rate limits, or account
              restrictions
            </Trans>
          </li>
          <li>
            <Trans>
              Scrape, reverse engineer, or automatically access the Service except as permitted by
              applicable law or an open-source license
            </Trans>
          </li>
          <li>
            <Trans>Use the Service to store or distribute unlawful or infringing content</Trans>
          </li>
        </ul>
      </section>
    </>
  );
}
