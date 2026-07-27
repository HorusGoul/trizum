import { Trans } from "@lingui/react/macro";

export function ServiceTerms() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>8. Advertising</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            The free installed Android and iOS apps may display advertising. Premium may remove
            advertising for the Premium owner as described on the purchase screen. Advertising and
            related privacy choices are explained in our Privacy Policy.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>9. Our Software and Intellectual Property</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            The Service, its branding, and its original content are protected by intellectual
            property laws. Subject to these Terms, we grant you a limited, personal, non-exclusive,
            non-transferable right to use the Service.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            Some trizum source code and third-party components are available under open-source
            licenses. Those licenses continue to govern the code and components they cover, and
            nothing in these Terms restricts rights granted by those licenses.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>10. Third-Party Services</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            The Service relies on or links to third-party services, including Apple, Google,
            RevenueCat, authentication providers, hosting providers, and error monitoring services.
            Their own terms and policies govern your use of their services. We are not responsible
            for third-party services that we do not control.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>11. Availability and Changes to the Service</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            We may maintain, update, add, remove, or change parts of the Service. We do not
            guarantee that the Service will always be available, uninterrupted, secure, or free of
            errors. We will not materially reduce an active paid subscription&apos;s recurring value
            without taking the steps required by applicable law and store rules.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            If the Service is discontinued, we will provide notice and any remedy required by
            applicable law or the store through which you purchased Premium.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>12. Suspension and Termination</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You may stop using the Service at any time. We may restrict or suspend access when
            reasonably necessary to protect users or the Service, investigate misuse, comply with
            law, or address a material breach of these Terms. When appropriate, we will give notice
            and an opportunity to resolve the issue.
          </Trans>
        </p>
      </section>
    </>
  );
}
