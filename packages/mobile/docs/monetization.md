# Native ads and purchases

[Back to package overview](../README.md). Read when changing AdMob, RevenueCat, purchase flows, or production monetization configuration.

### AdMob configuration

The native iOS and Android apps use `@capacitor-community/admob` for UMP
privacy choices, ATT, SDK initialization, and interstitial ads. The published
8.0.0 package does not expose App Open ads, so each platform also contains a
small `NativeAppOpenAd` Capacitor bridge over the same Google Mobile Ads SDK.
The browser app and installed PWA never initialize AdMob.

The trizum app IDs and test/live ad-unit IDs are public configuration in
`admob.config.json`. Builds always use trizum's app IDs so UMP resolves the
published consent message, and use Google's test ad-unit IDs unless
`TRIZUM_LIVE_ADS=true` is explicitly set. Set the `TRIZUM_LIVE_ADS_ENABLED`
repository variable to `true` for production App Store, Google Play, and signed
GitHub Release APK builds. TestFlight PR builds, Android internal-testing PR
builds, and non-production Play Store tracks use test ad-unit IDs regardless of
that variable. Ad-unit selection happens at build time: rebuild for production
instead of promoting a test-ad binary unchanged. A selected platform's build
fails when its chosen app ID or ad-unit ID is missing.

The PWA-side entitlement defaults to `unknown`, which suppresses SDK loading and
all ads. `PremiumProvider` supplies `AdEntitlementContext` with an explicit
`adFree` or `adSupported` result after RevenueCat resolves the signed-in
account. Subscription purchase UI registers a protected advertising flow while
active so App Open ads cannot cover it. Android also delays Google app
measurement until the consent-aware coordinator explicitly initializes Mobile
Ads.

Do not enable live ads until the Premium entitlement has landed, the privacy
policy and store disclosures match the resolved SDK behavior, UMP messages are
published and verified, and the focused legal review is complete. AdMob console
configuration must keep mediation disabled, keep Publisher First-Party ID
subject to privacy signals, and disable optional third-party identifier sharing,
Firebase enrichment, user-insight surveys, publisher-provided user IDs, and
content mapping.

### RevenueCat configuration

Ads and billing are optional capabilities, including for sideloaded Android APKs
on systems such as GrapheneOS. Do not gate app startup, navigation, expense
storage, or sync on either SDK, and do not disable ads solely because Play
billing is unavailable. Attempt ads only after consent permits them and the
account is known to be ad-supported; an unknown entitlement must still suppress
ads to protect existing Premium customers. Failed or blocked ad requests are
skipped without waiting in the expense-save flow.

Google Play purchases require a working Play Store setup. GrapheneOS users can
optionally install sandboxed Google Play in the app's profile; absence of that
setup must leave the rest of trizum usable. The paywall stays dismissible during
store requests. Dismissal does not cancel a store transaction, so purchase and
restore controls remain busy until it settles, including after reopening. Late
results must not close a newer paywall or update another account; the Premium
provider continues listening for entitlement updates independently.

The native apps use `@revenuecat/purchases-capacitor` for offerings, purchases,
restores, and entitlement state. The paywall itself is shared React UI so it
can use trizum's design system; `@revenuecat/purchases-capacitor-ui` remains in
use for RevenueCat Customer Center. Public iOS, Android, and Test Store API keys
are selected in `packages/pwa/src/lib/premium/revenueCatConfig.ts`; do not add a
RevenueCat secret key to either client package.

Production builds use the iOS or Android project. To build a local native app
against RevenueCat Test Store instead:

```bash
TRIZUM_REVENUECAT_TEST_STORE=true vp run --filter @trizum/mobile build
```

Purchases require a signed-in trizum account. The `premium` entitlement maps to
monthly, annual, and lifetime packages in the current `default` offering. The
annual package is the default paywall choice and is intended to have a seven-day
introductory trial. A Premium owner is ad-free; store family sharing is not an
entitlement source.

Before a production purchase build, connect App Store Connect and Google Play
credentials to the RevenueCat project, create or import the matching store
products and localized prices, configure the annual trial, and keep Apple
Family Sharing disabled. The app paywall reads the current RevenueCat offering,
so package availability, localized prices, and eligible introductory trials
must resolve in both sandboxes. Test purchase, cancellation, restore,
expiration, account switching, and lifetime access before enabling live ads.
