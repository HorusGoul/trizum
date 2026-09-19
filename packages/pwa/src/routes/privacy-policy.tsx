import { BackButton } from "#src/components/BackButton.js";
import { createFileRoute } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return renderPrivacyPolicyContent();
}

function renderPrivacyPolicyContent() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/about" }} />

        <h1 className="text-accent-900 dark:text-accent-100 max-h-12 truncate px-4 text-xl font-medium">
          Privacy Policy
        </h1>
      </div>

      <div className="container flex flex-1 flex-col gap-6 px-4 py-6">
        <p className="text-accent-600 dark:text-accent-400 text-sm">
          <Trans>Last updated: July 19, 2026</Trans>
        </p>

        <p className="text-accent-700 dark:text-accent-300">
          This Privacy Policy describes how trizum (&quot;we&quot;, &quot;our&quot;, or
          &quot;us&quot;) collects, uses, and protects your information when you use our expense
          splitting application (&quot;Service&quot;).
        </p>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            1. Information We Collect
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              1.1 Information You Provide
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              When you use trizum, you may provide the following information:
            </p>
            <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Party Information:
                </strong>{" "}
                Names of parties/groups, descriptions, and currency preferences
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Participant Information:
                </strong>{" "}
                Names of participants in your expense groups, and optionally phone numbers (if you
                choose to share them in your settings) and profile pictures
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Expense Data:
                </strong>{" "}
                Details about expenses including amounts, dates, descriptions, who paid, and how
                expenses are split
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Media Files:
                </strong>{" "}
                Photos and receipts you attach to expenses
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Account and Sign-In Information:
                </strong>{" "}
                If you use trizum cloud, we collect information needed to create and manage your
                account, such as your email address, password authentication data, linked Google or
                Apple sign-in methods, email verification status, and password or sign-in link
                requests
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Cloud Account Settings:
                </strong>{" "}
                If you use trizum cloud, we store the document pointer that connects your account to
                your cloud party list so your devices can load the same data
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              1.2 Automatically Collected Information
            </h3>
            <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Technical Data:
                </strong>{" "}
                Device information, browser type, operating system, and usage patterns
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Error Reports:
                </strong>{" "}
                When errors occur, we may collect diagnostic information through Sentry to help
                improve the Service
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Sync Data:
                </strong>{" "}
                Information about data synchronization between your devices
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Authentication Data:
                </strong>{" "}
                Session identifiers, cookies or native app bearer tokens, IP address, user agent,
                provider identifiers, and OAuth token metadata used to keep you signed in and secure
                your trizum cloud account
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              <Trans>1.3 Mobile Advertising Data</Trans>
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              <Trans>
                The installed Android and iOS apps may display advertising supplied through Google
                AdMob. The browser app and installed Progressive Web App do not display ads. Subject
                to your consent choices and device settings, the Google Mobile Ads SDK may
                automatically process IP-address-derived approximate location, device and operating
                system information, app interactions, advertising interactions, diagnostics,
                performance data, and device or advertising identifiers. On iOS, the advertising
                identifier (IDFA) is available only if you grant Apple&apos;s tracking permission.
              </Trans>
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <Trans>
                AdMob may create a pseudonymous Publisher First-Party ID that recognizes a device
                within our apps when third-party identifiers are unavailable. We do not connect
                Firebase Analytics, user-insight surveys, trizum account identifiers, or expense
                data to this identifier, and we disable optional third-party identifier sharing.
              </Trans>
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <Trans>
                We do not intentionally provide Google AdMob with group names, participant names,
                expense descriptions or amounts, currencies, receipts or other attached media, phone
                numbers, email addresses, trizum account IDs, authentication data, or synced
                document contents for advertising, targeting, or content mapping.
              </Trans>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            2. How We Use Your Information
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We use the information we collect to:
          </p>
          <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
            <li>Provide and maintain the Service</li>
            <li>Create, authenticate, secure, and manage trizum cloud accounts</li>
            <li>Send sign-in links, email verification links, and password reset emails</li>
            <li>Link Google, Apple, and password sign-in methods to the same trizum account</li>
            <li>Enable real-time synchronization of your expense data across your devices</li>
            <li>Allow collaboration with other participants in your expense groups</li>
            <li>Calculate balances and settlements between participants</li>
            <li>Store your data locally on your device for offline access</li>
            <li>Identify and fix technical issues through error reporting</li>
            <li>Improve and optimize the Service</li>
            <li>
              <Trans>
                Deliver, personalize where permitted, measure, and limit the frequency of mobile
                advertising, and detect advertising fraud and abuse
              </Trans>
            </li>
          </ul>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              <Trans>2.1 Legal Bases for Advertising</Trans>
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              <Trans>
                Where applicable law requires consent, we use Google&apos;s User Messaging Platform
                to request it before using local storage or personal data for personalized
                advertising. You may withdraw that consent through Privacy and cookie settings when
                that control is required. Where permitted without consent, non-personalized ad
                delivery, frequency control, measurement, security, and fraud prevention may be
                based on our legitimate interests in funding and protecting the Service, subject to
                your applicable rights and choices.
              </Trans>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            3. Data Storage and Synchronization
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              3.1 Local Storage
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses an offline-first architecture. Your data is primarily stored locally on
              your device using IndexedDB. This means your expense data is available even when
              you&apos;re offline. trizum may also use browser storage, cookies, or native app
              storage for settings, cloud account state, and sign-in tokens.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              3.2 trizum cloud
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              To enable synchronization across your devices and collaboration with others, your data
              is synchronized via WebSocket connections to our servers. This synchronization allows:
            </p>
            <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
              <li>Real-time updates when multiple users access the same expense group</li>
              <li>Access to your data from multiple devices</li>
              <li>Automatic conflict resolution when changes occur simultaneously</li>
            </ul>
            <p className="text-accent-700 dark:text-accent-300">
              If you sign in to trizum cloud, your account data and cloud account settings are
              stored in Cloudflare D1. Cloud account settings include the party list document
              pointer associated with your account. This lets your signed-in devices find the same
              cloud party list.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              3.3 Data Encryption
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Data transmitted between your device and our servers is encrypted using HTTPS and
              secure WebSocket connections (WSS). OAuth tokens stored by our authentication system
              are encrypted. However, please note that expense data, media files, and sync documents
              stored on our servers are not end-to-end encrypted and may be accessible to us for the
              purposes of providing the Service, synchronization, support, security, and abuse
              prevention.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              3.4 Access Model
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses a link-based access model for expense groups (parties). Anyone who has
              access to a party link can view and modify the expense group associated with that
              link. A trizum cloud account lets you sign in and load your cloud party list across
              devices, but it does not make party links private or revoke access from people who
              already have a party link. Please keep your expense group links secure and only share
              them with trusted individuals.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            4. Data Sharing and Access
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              4.1 Sharing with Other Users
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              trizum uses a peer-to-peer sharing model. When you create an expense group (party), it
              is accessible to anyone who has the link to that group. This means that anyone with
              access to the link can view and modify all information in that expense group,
              including participant names, expenses, media files, and any optional phone numbers if
              shared. Please keep your expense group links secure and only share them with people
              you trust.
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                Important:
              </strong>{" "}
              You can use trizum without creating an account. Accounts are used for trizum cloud
              sign-in, linked sign-in methods, and loading your cloud party list on multiple
              devices. Access to individual expense groups is still controlled by link sharing. If
              someone gains access to a link, they can access the associated expense group.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              4.2 Third-Party Services
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              We use the following third-party services:
            </p>
            <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Cloudflare:
                </strong>{" "}
                We use Cloudflare Workers, D1, Send Email, logs, and related infrastructure to host
                the Service, store account and cloud account settings, send authentication emails,
                and operate trizum cloud.
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Google:
                </strong>{" "}
                If you choose to continue with Google or link Google as a sign-in method, Google
                provides authentication information such as your email address and provider
                identifier.
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Apple:
                </strong>{" "}
                If you choose to continue with Apple or link Apple as a sign-in method, Apple
                provides authentication information such as your email address and provider
                identifier.
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  Sentry:
                </strong>{" "}
                We use Sentry for error tracking and performance monitoring. Sentry may collect
                technical information about errors and performance issues. For more information, see{" "}
                <a
                  href="https://sentry.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
                >
                  Sentry&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-accent-900 dark:text-accent-100 font-semibold">
                  <Trans>Google AdMob:</Trans>
                </strong>{" "}
                <Trans>
                  The installed mobile apps use Google AdMob to request, display, personalize where
                  permitted, measure, and protect advertising. Google and authorized buyers or
                  advertising partners may receive ad-request data for these purposes even though
                  trizum does not integrate separate third-party mediation SDKs. See
                </Trans>{" "}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
                >
                  <Trans>How Google uses information from partner apps</Trans>
                </a>{" "}
                <Trans>and</Trans>{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
                >
                  <Trans>Google&apos;s Privacy Policy</Trans>
                </a>{" "}
                <Trans>and its</Trans>{" "}
                <a
                  href="https://business.safety.google/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
                >
                  <Trans>Business Data Responsibility information</Trans>
                </a>
                .
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              4.3 Legal Requirements
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              We may disclose your information if required by law or in response to valid legal
              requests, such as court orders or subpoenas.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            5. Your Rights and Choices
          </h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              5.1 Access and Deletion
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              You can access, modify, or delete your data at any time through the Service. To delete
              your data:
            </p>
            <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
              <li>Delete individual expenses or participants within the app</li>
              <li>Delete entire expense groups</li>
              <li>Clear your local data by clearing your browser&apos;s IndexedDB storage</li>
              <li>Sign out of trizum cloud on a device from cloud settings</li>
              <li>Delete your trizum cloud account from cloud settings</li>
            </ul>
            <p className="text-accent-700 dark:text-accent-300">
              Deleting your trizum cloud account deletes your account profile, sessions, linked
              sign-in methods, and cloud account settings. It does not automatically delete expense
              group data that is still available through shared links or synchronized with other
              participants. To remove expense group data, delete it inside the Service.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              5.2 Data Portability
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Your data is stored in a standard format. You can export your data through the
              Service&apos;s export functionality, if available.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              5.3 Error Reporting and Operational Logs
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              Error reporting through Sentry is only active in production builds. trizum cloud also
              uses operational logs and traces to run authentication, cloud settings, and sync
              services. These logs are intended for security, abuse prevention, debugging, and
              reliability. Contact us if you have questions about error reporting or operational
              logging.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
              <Trans>5.4 Advertising and Tracking Choices</Trans>
            </h3>
            <p className="text-accent-700 dark:text-accent-300">
              <Trans>
                When required, the mobile app displays Privacy and cookie settings so you can review
                or withdraw consent and exercise applicable opt-out rights. Under some US state
                laws, personalized advertising may be considered a sale or sharing of personal
                information; covered users can opt out through that control. On iOS, Apple&apos;s
                tracking permission is separate and can be changed in iOS Settings. Declining
                personalized advertising or tracking does not prevent you from using trizum, and ads
                may still be shown without the declined signals.
              </Trans>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            6. Data Retention
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We retain your data to provide the Service. Data stored locally on your device will
            persist until you delete it or clear your browser&apos;s storage. Data stored on our
            synchronization servers is retained to enable synchronization across devices and
            collaboration between users.
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            trizum cloud account data is retained while your account remains active. Authentication
            sessions and verification or reset records expire according to the authentication
            system&apos;s security rules. Cloud account settings are deleted when you delete your
            trizum cloud account.
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            Expense group and sync data that has not been accessed for 12 months may be
            automatically deleted from our synchronization servers. When you delete an expense group
            or its data through the Service, the deletion is synchronized to other devices that can
            access the group. Please note that this policy may change in the future with the
            introduction of paid plans and freemium limits.
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              The mobile app keeps a device-local record of first-use completion and the most recent
              full-screen ad to enforce advertising frequency limits. It is not synchronized and
              remains until you clear the app&apos;s data or uninstall it. Google controls retention
              of data processed by AdMob according to its published retention practices and your
              advertising choices.
            </Trans>
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            7. Children&apos;s Privacy
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            trizum is not intended for users under the age of 18. We do not knowingly collect
            personal information from children. If you believe we have collected information from a
            child, please contact us immediately.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            8. International Data Transfers
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              Our infrastructure, sign-in, monitoring, and advertising providers may process data
              outside your country of residence. Where required, these transfers rely on applicable
              legal safeguards such as adequacy decisions, the EU-US and Swiss-US Data Privacy
              Frameworks and UK Extension, or Standard Contractual Clauses. Provider privacy notices
              describe their specific locations and safeguards. Contact us if you need more
              information about safeguards relevant to your data.
            </Trans>
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            9. Security
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We implement reasonable security measures to protect your data, including:
          </p>
          <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
            <li>Encrypted data transmission (HTTPS and WSS)</li>
            <li>Secure cookies for web sign-in where supported</li>
            <li>Bearer token handling for native app sign-in</li>
            <li>Encrypted OAuth token storage for linked sign-in providers</li>
            <li>Secure server infrastructure</li>
            <li>Regular security assessments</li>
          </ul>
          <p className="text-accent-700 dark:text-accent-300">
            However, no method of transmission or storage is 100% secure. While we strive to protect
            your data, we cannot guarantee absolute security.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            10. Changes to This Privacy Policy
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the new Privacy Policy on this page and updating the &quot;Last
            updated&quot; date. You are advised to review this Privacy Policy periodically for any
            changes.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            11. Contact Us
          </h2>
          <div className="bg-accent-50 dark:bg-accent-900 rounded-lg p-4">
            <p className="text-accent-700 dark:text-accent-300 mb-2">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <p className="text-accent-700 dark:text-accent-300">
              <strong className="text-accent-900 dark:text-accent-100 font-semibold">
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
                className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 underline"
              >
                hola@horus.dev
              </a>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
            12. Jurisdiction and Governing Law
          </h2>
          <p className="text-accent-700 dark:text-accent-300">
            This Privacy Policy is governed by the laws of Spain and the European Union. As trizum
            is operated from Spain, we comply with the General Data Protection Regulation (GDPR) and
            Spanish data protection laws. If you are located in the European Economic Area (EEA),
            you have certain rights under GDPR, including:
          </p>
          <ul className="text-accent-700 dark:text-accent-300 ml-6 list-disc space-y-2">
            <li>The right to access your personal data</li>
            <li>The right to rectification of inaccurate data</li>
            <li>The right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>The right to restrict processing</li>
            <li>The right to data portability</li>
            <li>The right to object to processing</li>
          </ul>
          <p className="text-accent-700 dark:text-accent-300">
            To exercise these rights, please contact us using the information provided in Section
            11. You also have the right to lodge a complaint with the Spanish Data Protection Agency
            (AEPD) if you believe your data rights have been violated.
          </p>
        </section>
      </div>
    </div>
  );
}
