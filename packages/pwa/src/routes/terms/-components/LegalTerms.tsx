import { Trans } from "@lingui/react/macro";

export function LegalTerms() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>13. Disclaimers and Liability</Trans>
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          <Trans>
            To the extent permitted by law, the Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties that are not expressly stated in these Terms. You
            remain responsible for keeping appropriate records and backups and for verifying
            information before acting on it.
          </Trans>
        </p>
        <p className="text-neutral-600 dark:text-neutral-400">
          <Trans>
            To the extent permitted by law, we are not liable for indirect, incidental, special,
            consequential, or punitive losses, or for losses caused by inaccurate User Content,
            disputes between participants, third-party services, or events outside our reasonable
            control. Nothing in these Terms excludes or limits liability that cannot legally be
            excluded or limited.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>14. Governing Law and Consumer Rights</Trans>
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          <Trans>
            These Terms are governed by the laws of Spain. If you are a consumer, you also keep the
            protections of mandatory consumer law in the country where you live, and you may bring a
            claim in any court available to you under that law. Before starting formal proceedings,
            we encourage you to contact us so we can try to resolve the issue.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>15. Changes to These Terms</Trans>
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          <Trans>
            We may update these Terms to reflect changes to the Service, law, security, or our
            business. We will post the updated Terms and change the &quot;Last updated&quot; date.
            If a change materially affects your rights, we will provide additional notice when
            required. Your continued use after the updated Terms take effect means you accept them,
            except where applicable law requires another form of consent.
          </Trans>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>16. Contact Us</Trans>
        </h2>
        <div className="shadow-surface rounded-3xl bg-white p-5 dark:bg-neutral-900">
          <p className="mb-2 text-neutral-600 dark:text-neutral-400">
            <Trans>If you have questions about these Terms, please contact us:</Trans>
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            <strong className="font-semibold text-neutral-950 dark:text-neutral-50">
              Horus Lugo López
            </strong>
            <br />
            Calle Cardenal Lluch, 27
            <br />
            Seville, Spain
            <br />
            <Trans>Email:</Trans>{" "}
            <a
              href="mailto:hola@horus.dev"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
            >
              hola@horus.dev
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
