import { BackButton } from "#src/components/BackButton.js";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="pl-4 text-2xl font-bold text-accent-900 dark:text-accent-100">
          Privacy Policy
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-6 px-4 py-6">
        <p className="text-sm text-accent-600 dark:text-accent-400">
          Last updated: December 9, 2025
        </p>

        <p className="text-accent-700 dark:text-accent-300">
          This Privacy Policy describes how trizum (&quot;we&quot;,
          &quot;our&quot;, or &quot;us&quot;) collects, uses, and protects your
          information when you use our expense splitting application
          (&quot;Service&quot;).
        </p>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            1. Information We Collect
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              1.1 Information You Provide
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              When you use trizum, you may provide the following information:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Party Information:
                </strong>{" "}
                Names of parties/groups, descriptions, and currency preferences
              </li>
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Participant Information:
                </strong>{" "}
                Names of participants in your expense groups, and optionally
                phone numbers (if you choose to share them in your settings) and
                profile pictures
              </li>
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Expense Data:
                </strong>{" "}
                Details about expenses including amounts, dates, descriptions,
                who paid, and how expenses are split
              </li>
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Media Files:
                </strong>{" "}
                Photos and receipts you attach to expenses
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              1.2 Automatically Collected Information
            </h3>
            <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Technical Data:
                </strong>{" "}
                Device information, browser type, operating system, and usage
                patterns
              </li>
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Error Reports:
                </strong>{" "}
                When errors occur, we may collect diagnostic information through
                Sentry to help improve the Service
              </li>
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Sync Data:
                </strong>{" "}
                Information about data synchronization between your devices
              </li>
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            2. How We Use Your Information
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We use the information we collect to:
          </p>
          <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
            <li>Provide and maintain the Service</li>
            <li>
              Enable real-time synchronization of your expense data across your
              devices
            </li>
            <li>
              Allow collaboration with other participants in your expense groups
            </li>
            <li>Calculate balances and settlements between participants</li>
            <li>Store your data locally on your device for offline access</li>
            <li>Identify and fix technical issues through error reporting</li>
            <li>Improve and optimize the Service</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            3. Data Storage and Synchronization
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              3.1 Local Storage
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses an offline-first architecture. Your data is primarily
              stored locally on your device using IndexedDB. This means your
              expense data is available even when you&apos;re offline.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              3.2 Cloud Synchronization
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              To enable synchronization across your devices and collaboration
              with others, your data is synchronized via WebSocket connections
              to our servers. This synchronization allows:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
              <li>
                Real-time updates when multiple users access the same expense
                group
              </li>
              <li>Access to your data from multiple devices</li>
              <li>
                Automatic conflict resolution when changes occur simultaneously
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              3.3 Data Encryption
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Data transmitted between your device and our servers is encrypted
              using secure WebSocket connections (WSS). However, please note
              that data stored on our servers is not end-to-end encrypted and
              may be accessible to us for the purposes of providing the Service
              and synchronization.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              3.4 Access Model
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses a peer-to-peer sharing model based on link-based
              access. Expense groups (parties) are accessed through shareable
              links. Anyone who has access to a link can view and modify the
              expense group associated with that link. Please keep your expense
              group links secure and only share them with trusted individuals.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            4. Data Sharing and Access
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              4.1 Sharing with Other Users
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses a peer-to-peer sharing model. When you create an
              expense group (party), it is accessible to anyone who has the link
              to that group. This means that anyone with access to the link can
              view and modify all information in that expense group, including
              participant names, expenses, media files, and any optional phone
              numbers if shared. Please keep your expense group links secure and
              only share them with people you trust.
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <strong className="font-semibold text-accent-900 dark:text-accent-100">
                Important:
              </strong>{" "}
              We do not require user accounts or authentication. Access to
              expense groups is controlled solely by link sharing. If someone
              gains access to a link, they can access the associated expense
              group.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              4.2 Third-Party Services
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              We use the following third-party services:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
              <li>
                <strong className="font-semibold text-accent-900 dark:text-accent-100">
                  Sentry:
                </strong>{" "}
                We use Sentry for error tracking and performance monitoring.
                Sentry may collect technical information about errors and
                performance issues. For more information, see{" "}
                <a
                  href="https://sentry.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
                >
                  Sentry&apos;s Privacy Policy
                </a>
                .
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              4.3 Legal Requirements
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              We may disclose your information if required by law or in response
              to valid legal requests, such as court orders or subpoenas.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            5. Your Rights and Choices
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              5.1 Access and Deletion
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              You can access, modify, or delete your data at any time through
              the Service. To delete your data:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
              <li>Delete individual expenses or participants within the app</li>
              <li>Delete entire expense groups</li>
              <li>
                Clear your local data by clearing your browser&apos;s IndexedDB
                storage
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              5.2 Data Portability
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Your data is stored in a standard format. You can export your data
              through the Service&apos;s export functionality, if available.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-accent-900 dark:text-accent-100">
              5.3 Opt-Out of Error Reporting
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Error reporting through Sentry is only active in production
              builds. If you prefer not to have error data collected, you may
              use a development build or contact us to discuss alternatives.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            6. Data Retention
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We retain your data to provide the Service. Data stored locally on
            your device will persist until you delete it or clear your
            browser&apos;s storage. Data stored on our synchronization servers
            is retained to enable synchronization across devices and
            collaboration between users.
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            All data that has not been accessed for 12 months may be
            automatically deleted from our synchronization servers.
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            When you delete an expense group or its data through the Service, it
            will be removed from our synchronization servers. Please note that
            this policy may change in the future with the introduction of paid
            plans and freemium limits.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            7. Children&apos;s Privacy
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            trizum is not intended for users under the age of 18. We do not
            knowingly collect personal information from children. If you believe
            we have collected information from a child, please contact us
            immediately.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            8. International Data Transfers
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            Your data may be stored and processed in servers located outside
            your country of residence. By using the Service, you consent to the
            transfer of your data to these locations.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            9. Security
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We implement reasonable security measures to protect your data,
            including:
          </p>
          <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
            <li>Encrypted data transmission (WSS)</li>
            <li>Secure server infrastructure</li>
            <li>Regular security assessments</li>
          </ul>
          <p className="text-accent-700 dark:text-accent-300">
            However, no method of transmission or storage is 100% secure. While
            we strive to protect your data, we cannot guarantee absolute
            security.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            10. Changes to This Privacy Policy
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new Privacy Policy on
            this page and updating the &quot;Last updated&quot; date. You are
            advised to review this Privacy Policy periodically for any changes.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            11. Contact Us
          </h2>
          <div className="rounded-lg bg-accent-50 p-4 dark:bg-accent-900">
            <p className="mb-2 text-accent-700 dark:text-accent-300">
              If you have any questions about this Privacy Policy, please
              contact us:
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <strong className="font-semibold text-accent-900 dark:text-accent-100">
                Horus Lugo López
              </strong>
              <br />
              Calle Cardenal Lluch, 27
              <br />
              Seville, Spain
              <br />
              Email:{" "}
              <a
                href="mailto:hola@horus.dev"
                className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
              >
                hola@horus.dev
              </a>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-accent-900 dark:text-accent-100">
            12. Jurisdiction and Governing Law
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            This Privacy Policy is governed by the laws of Spain and the
            European Union. As trizum is operated from Spain, we comply with the
            General Data Protection Regulation (GDPR) and Spanish data
            protection laws. If you are located in the European Economic Area
            (EEA), you have certain rights under GDPR, including:
          </p>
          <ul className="ml-6 list-disc space-y-2 text-accent-700 dark:text-accent-300">
            <li>The right to access your personal data</li>
            <li>The right to rectification of inaccurate data</li>
            <li>The right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>The right to restrict processing</li>
            <li>The right to data portability</li>
            <li>The right to object to processing</li>
          </ul>
          <p className="text-accent-700 dark:text-accent-300">
            To exercise these rights, please contact us using the information
            provided in Section 11. You also have the right to lodge a complaint
            with the Spanish Data Protection Agency (AEPD) if you believe your
            data rights have been violated.
          </p>
        </section>
      </div>
    </div>
  );
}
