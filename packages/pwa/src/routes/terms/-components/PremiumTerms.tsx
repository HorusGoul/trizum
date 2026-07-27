import { Trans } from "@lingui/react/macro";

export function PremiumTerms() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>6. Premium Purchases</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            Premium is optional. The purchase screen describes the features included with Premium
            and displays the price and billing period that apply in your store and region. Features
            may differ by platform when required by platform capabilities or store rules.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            Purchases are processed by Apple or Google through the store account you use to buy
            Premium. Prices may include or exclude taxes depending on your location and store
            settings. Your purchase is also associated with the trizum account signed in at the time
            of purchase so that eligible Premium access can be restored across your signed-in
            devices.
          </Trans>
        </p>

        <div className="flex flex-col gap-3">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans>6.1 Monthly and Annual Subscriptions</Trans>
          </h3>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              Monthly and annual subscriptions automatically renew for another billing period unless
              canceled through the applicable store before renewal. Your store account is charged at
              confirmation and at each renewal using the price shown by the store, subject to any
              advance notice or consent the store or applicable law requires.
            </Trans>
          </p>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              When an eligible annual subscription includes a seven-day free trial, the purchase
              screen will show the trial and post-trial price. Unless you cancel before the trial
              ends, the subscription automatically converts to a paid annual subscription. Trial
              eligibility is determined by the applicable store.
            </Trans>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans comment="Lifetime means a one-time Premium purchase, not the user's lifespan">
              6.2 Lifetime Purchase
            </Trans>
          </h3>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans>
              The Lifetime option is a one-time, non-consumable purchase that provides non-expiring
              access to the Premium entitlement for the purchasing account while trizum continues to
              offer and operate the Service. It is not a subscription and does not renew
              automatically.
            </Trans>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-accent-900 dark:text-accent-100 text-xl font-semibold">
            <Trans comment="Party Boost means Premium benefits assigned to one shared-expense group">
              6.3 Premium Ownership and Party Boosts
            </Trans>
          </h3>
          <p className="text-accent-700 dark:text-accent-300">
            <Trans comment="Party means a shared-expense group, not a celebration">
              Premium belongs to the purchasing person and may not be transferred, resold, or shared
              as a separate account entitlement. A Premium owner may assign a Party Boost to one
              eligible group under the rules shown in the app. A Party Boost gives that group the
              group-level benefits described in the app; it does not make every group member a
              Premium owner or remove all advertising for them.
            </Trans>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-accent-900 dark:text-accent-100 text-2xl font-semibold">
          <Trans>7. Cancellation, Refunds, and Price Changes</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            You can manage or cancel a subscription through the Customer Center in trizum or through
            your Apple App Store or Google Play account. Deleting trizum or deleting your trizum
            account does not cancel a store subscription.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            Cancellation normally takes effect at the end of the current paid billing period.
            Refunds and immediate cancellation requests are handled under the applicable
            store&apos;s rules and mandatory consumer law. Nothing in these Terms limits any refund,
            withdrawal, cancellation, or other right that applicable law gives you.
          </Trans>
        </p>
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>
            We may change subscription prices for valid reasons such as changes to features,
            operating costs, taxes, exchange rates, inflation, or legal requirements. Price changes
            apply to future billing periods and will be communicated in advance through the
            applicable store or in the Service when required. You may cancel before the new price
            takes effect.
          </Trans>
        </p>
      </section>
    </>
  );
}
