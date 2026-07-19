# AdMob privacy-policy and disclosure requirements

Status: research note

Reviewed: July 19, 2026

Scope: trizum's Capacitor iOS and Android apps using Google AdMob App Open and
Interstitial ads, Google demand without separately integrated mediation SDKs,
Google UMP, optional iOS ATT after the first-use session, and no intentional
transfer of trizum expense, party, participant, media, or account data to
advertising.

This is an implementation-oriented reading of current official product policies
and regulator guidance, not legal advice. The final lawful-basis, international
transfer, and US state-law language should be checked against the AdMob account's
actual configuration and contracts before release.

## Executive conclusion

The privacy policy needs more than a sentence saying that the mobile app uses
AdMob. It should clearly state:

1. that advertising applies only to the installed iOS and Android apps, not the
   browser/PWA distribution;
2. that the Google Mobile Ads SDK and UMP automatically collect or receive
   device, network, advertising, interaction, and diagnostic information;
3. how Google and its advertising partners use that information for ad delivery,
   personalization when permitted, measurement/analytics, SDK improvement,
   security, and fraud prevention;
4. that non-personalized or limited/contextual ads can still use signals such as
   IP-derived approximate location and ad interactions for delivery, measurement,
   and fraud prevention;
5. that trizum does not intentionally send expense, party, participant, amount,
   currency, receipt/media, email, or trizum account identifiers to AdMob;
6. how European consent, US opt-out choices, and iOS ATT differ and how a user can
   revisit the applicable privacy choices;
7. Google's retention and international processing, with links to Google's own
   detailed disclosures; and
8. that Google and any other party shown in the UMP vendor list receive data as
   configured, even though trizum does not install third-party mediation SDKs.

The existing policy already covers the controller/contact, general security,
retention, rights, and children at a high level. The AdMob revision should update
the existing sections for automatically collected information, purposes, third
parties, choices, retention, international transfers, and the “Last updated”
date, rather than adding an isolated paragraph that conflicts with the rest of
the document.

## Why the policy must be this explicit

- Google Publisher Policies require a privacy policy that clearly discloses all
  collection, sharing, and use caused by Google products, including the
  technologies involved such as IP addresses and other identifiers. Google
  offers a prominent link to its partner-data explanation as a way to satisfy
  the Google-specific part of the disclosure. [Google Publisher Policies —
  Privacy disclosures](https://support.google.com/adsense/answer/10502938#privacy)
- Google Play requires the policy, together with in-app disclosures, to
  comprehensively describe how the app accesses, collects, uses, and shares user
  and device data. It must include developer/contact information, data types,
  recipients, secure handling, retention/deletion, a clear privacy-policy label,
  and an active, public, non-geofenced, non-PDF URL; it must be linked both in
  Play Console and in the app. [Google Play Developer Program Policy — Privacy
  Policy](https://support.google.com/googleplay/android-developer/answer/17190352#privacy-policy)
- Apple requires the privacy policy in App Store Connect and easily accessible
  in the app. It must identify what data is collected, how, and every use;
  confirm that recipients such as ad networks and third-party SDKs provide the
  same or equal protection; and explain retention/deletion and how to revoke
  consent or request deletion. [Apple App Review Guidelines
  5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)
- Because trizum is operated from Spain, its notice must also cover the GDPR
  transparency baseline: controller/contact, purposes, categories, legal basis,
  retention, recipients, transfers outside the EU, rights, complaint rights,
  withdrawal of consent, and relevant automated decision-making. The information
  must be concise, transparent, intelligible, accessible, and in plain language.
  [European Commission — Information that must be given to
  individuals](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr/what-information-must-be-given-individuals-whose-data-collected_en)

## AdMob data that the policy should describe

The policy should say that the SDK collects this information automatically from
the mobile app when AdMob is initialized, ads are requested or shown, or the user
interacts with an ad. It should not imply that trizum itself can view every raw
signal.

### Android

Google's current Android disclosure says the Mobile Ads SDK automatically
collects and shares:

- IP address, which can estimate general location;
- product interactions, including app launches, taps, and video views;
- diagnostics, including launch time, hangs, and energy usage; and
- device/account identifiers, including the Android advertising ID, app set ID,
  and, where applicable, other device account-related identifiers.

Google lists advertising, analytics, and fraud prevention as the purposes and
states that the data is encrypted in transit. Android advertising-ID collection
can be disabled, and limited-ad modes can suppress it. [Google Mobile Ads SDK —
Google Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)

### iOS

Google's current iOS disclosure says the Mobile Ads SDK may collect:

- IP address, which can estimate general location;
- crash logs and diagnostics;
- user-associated performance data such as launch time, hang rate, or energy
  usage;
- device IDs, including IDFA or app/developer-bounded identifiers;
- advertising data, such as ads the user has seen; and
- product interactions such as launches, taps, and video views.

Google describes uses including ad delivery, third-party advertising,
analytics, advertising performance, SDK/product improvement, and sharing with
entities that display ads. [Google Mobile Ads SDK — App Store data
disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure)

### Personalized versus non-personalized ads

The policy must not say that rejecting personalization stops all advertising or
all processing. Google says that when ad personalization is off, ads may still be
based on the current app/topic, current context, or general location. Data can
still be used to measure advertising and protect against fraud and abuse.
[Google — How Google uses information from partner sites and
apps](https://policies.google.com/technologies/partner-sites)

For trizum, accurate language is: personalized ads are used only where the
applicable UMP choice and, on iOS, ATT status permit them; otherwise Google may
serve limited, non-personalized, or contextual ads if UMP reports that ads can be
requested. Declining personalization or ATT is not the ad-free Premium benefit.

### Google-only demand is not the same as Google-only data receipt

No mediation SDKs should be described because none are planned. However, the
policy must not promise that data goes only to Google. Google's display-advertising
disclosure explains that, depending on permissions and configuration, bid-request
data can be disclosed to advertising partners. That data can include app/ad-slot
information, publisher information, approximate location, IP address, device
metadata, operating-system metadata, and user-resettable advertising identifiers
for personalized ads. [Google Business Data Responsibility — Display
advertising](https://business.safety.google/privacy/display-advertising/)

Google's EU User Consent Policy separately requires each party that may collect,
receive, or use personal data because of the Google product to be clearly
identified, with accessible information about its use. [Google EU User Consent
Policy](https://www.google.com/about/company/user-consent-policy/)

Therefore:

- the policy should identify Google AdMob and link prominently to
  [Google's partner-data explanation](https://policies.google.com/technologies/partner-sites)
  and [Business Data Responsibility](https://business.safety.google/privacy/);
- the UMP message must show the actual Google/ad-technology partners selected in
  AdMob, with their details; and
- “Google demand only” should be described as no separately integrated
  third-party mediation SDKs, not as a guarantee that no advertiser, authorized
  buyer, or other partner receives an ad request.

## The trizum advertising-data boundary

The final policy should make this product promise explicit:

> trizum does not intentionally provide Google AdMob with party or group names,
> participant names, expense descriptions, amounts, currencies, attached receipts
> or media, phone numbers, email addresses, trizum account IDs, authentication
> data, or the contents of synced documents for advertising, targeting, or
> content mapping.

This promise does not erase the SDK collection listed above. Public AdMob
publisher, app, and ad-unit IDs also necessarily identify trizum's publisher
account, app, and placement; they are not end-user domain data.

### Required SDK/configuration consequence

The Google Mobile Ads SDK's **publisher first-party ID** is an identifier assigned
to a unique user within a publisher's apps and is enabled by default when
third-party device IDs are absent. Google says it can support personalization
using data collected from the apps. It can be disabled in both SDKs and the
AdMob account. [Google AdMob — First-party identifiers and
data](https://support.google.com/admob/answer/14199649)

After considering the published revenue evidence below, the agreed boundary
permits this AdMob-generated identifier for consent-governed ad delivery and
personalization. Release configuration should:

- keep publisher first-party ID enabled in Android and iOS, subject to UMP,
  device, and publisher privacy signals ([Android API](https://developers.google.com/admob/android/privacy/strategies),
  [iOS API](https://developers.google.com/admob/ios/privacy/strategies#first-party-id));
- disable optional third-party identifier sharing in AdMob;
- not connect Firebase Analytics or other app analytics to AdMob for
  first-party-data enrichment;
- not enable AdMob user-insight surveys, publisher-provided user IDs, content
  mapping, or other optional first-party-data features; and
- not attach trizum account, party, expense, participant, currency, or content
  fields to ad requests or ad diagnostics.

The privacy policy should not claim this boundary until these controls are
verified in code and in the AdMob console.

### Revenue tradeoff of disabling publisher first-party ID

The only public Google quantity found is an average **31% ad-revenue lift on
iOS inventory where IDFA was absent** among developers that adopted a Google
Mobile Ads SDK version supporting “same app key,” the former name for publisher
first-party ID. Google does not publish the study's sample, distribution,
regions, ad formats, demand mix, consent mix, or an Android result, and its
wording compares SDK adoption rather than describing a randomized identifier
on/off experiment. It is therefore evidence that the effect can be material in
the affected iOS segment, not a forecast that trizum would lose 31% of total ad
revenue. [Google AdMob — 4 strategies to drive durable app growth in
2023](https://blog.google/products/admob/4-strategies-to-drive-durable-app-growth-in-2023/)

If that published uplift transferred exactly to trizum's no-IDFA cohort, an
enabled cohort earning `1.31x` the disabled baseline means disabling the feature
would earn about **23.7% less for that cohort relative to leaving it enabled**
(`1 - 1 / 1.31`). That is only a mathematical reframing of Google's figure, not
a measured trizum result. The total-app percentage would be smaller in
proportion to the share of monetized traffic in that affected cohort.

Publisher first-party ID is distinct from IDFA and Android's advertising ID:
AdMob uses it when those third-party device IDs are absent. It is also distinct
from optional Firebase/app-analytics enrichment, which sends additional
analytics events into its profile and is not planned for trizum. The likely
revenue effect is concentrated where a third-party ID is missing **and** the
applicable privacy choices permit personalization. Google says the identifier
respects TCF, NPA, RDP, device, and publisher controls; sharing it to RTB demand
is currently unavailable in the EEA, Switzerland, and the UK. That regional RTB
limit does not establish that Google itself derives no value from the identifier
there. [Google AdMob — First-party identifiers and
data](https://support.google.com/admob/answer/14199649)

Google has not published an AdMob breakdown showing whether the reported lift
came from higher eCPM, match rate, impression volume, or a combination. A
trizum-specific decision therefore needs production measurement after enough
traffic exists. The AdMob Ads Activity report's Identity tab can compare
first-party-ID, third-party-ID, no-personalization, and no-ID inventory, but
those historical cohorts are not a causal experiment because identifier
availability correlates with platform, region, and privacy choice. If trizum
later runs a disclosed, controlled on/off test, it should compare estimated
earnings per eligible ad opportunity together with eCPM, match rate, show rate,
and impressions, segmented at least by platform, country/consent regime, ATT or
advertising-ID availability, and ad format. Google identifies those as the key
metrics behind revenue changes. [Google AdMob — First-party identifiers and
data](https://support.google.com/admob/answer/14199649), [Google AdMob — Using
AdMob insights](https://support.google.com/admob/answer/9397587)

### Selected plugin versions and API gap

The selected `@capacitor-community/admob` 8.0.0 line currently declares:

- iOS `Google-Mobile-Ads-SDK ~> 12.14` in its
  [podspec](https://github.com/capacitor-community/admob/blob/000fce982432fdfb92229c7cb47caf861a1fb66b/CapacitorCommunityAdmob.podspec#L18);
- Android `play-services-ads 24.9.+` and UMP `4.0.0` in its
  [Gradle configuration](https://github.com/capacitor-community/admob/blob/000fce982432fdfb92229c7cb47caf861a1fb66b/android/build.gradle#L1-L8); and
- no publisher-first-party-ID option in the plugin's JavaScript
  [`AdMobInitializationOptions`](https://github.com/capacitor-community/admob/blob/000fce982432fdfb92229c7cb47caf861a1fb66b/src/definitions.ts#L59-L110).

The published 8.0.0 package also does not expose App Open ads, although the
plugin repository's unreleased main branch documents and implements that
format. trizum therefore uses the released package for UMP, ATT, SDK
initialization, and interstitials, plus a deliberately narrow native Capacitor
bridge for loading and presenting App Open ads with the same Google Mobile Ads
SDK dependency. The bridge owns no consent or eligibility policy and should be
removed in favor of the community API after a compatible release is published
and verified.

Google's iOS privacy documentation says publisher first-party ID has been
enabled by default since SDK 10.14 and exposes a native API to disable it.
[Google Mobile Ads SDK — iOS publisher first-party
ID](https://developers.google.com/admob/ios/privacy/strategies#first-party-id)
The plugin's iOS 12.14 dependency is therefore affected, but the community
plugin does not currently expose that native switch through its JavaScript
initialization interface. Because the agreed initial configuration keeps the
identifier enabled, no native extension is required for that decision. The
release still needs to verify the SDK default and matching AdMob console
controls; a future decision to disable it would require a native/plugin switch
or another verified configuration path.

There is also a disclosure-version mismatch to manage deliberately. Google's
current Android data-disclosure page describes the latest 25.4 SDK, while this
plugin currently resolves the 24.9.x line. The latest page is useful for the
likely data categories but is not sufficient evidence for the exact Play Data
Safety answers. The release must inspect the resolved Gradle dependency and
validate 24.9.x behavior before choosing labels; upgrading later to 25.x
requires the same review again.

## Recommended privacy-policy coverage

The final policy can express the required information in one dedicated
“Advertising in the mobile apps” subsection and cross-reference it from the
existing collection, sharing, choices, retention, and transfer sections.

### 1. Applicability

- AdMob runs only in the installed iOS and Android apps.
- The browser-hosted Web App/PWA does not initialize AdMob or show these ads.
- Users with a confirmed Ad-Free Entitlement do not initialize AdMob or request
  ads; unknown entitlement state also does not initialize it.

### 2. Provider and collection method

- Name Google AdMob and Google UMP.
- Explain that the SDK collects data automatically from the device and ad
  interactions when advertising is eligible and initialized.
- Explain that trizum receives AdMob reporting, normally aggregated ad
  performance and revenue information, rather than all underlying raw device
  signals.

### 3. Categories and purposes

Include the Android/iOS categories above and these purposes:

- selecting, delivering, and frequency-capping ads;
- personalizing ads only when the applicable choices permit it;
- contextual or limited/non-personalized ad delivery;
- measuring impressions, interactions, performance, and effectiveness;
- diagnostics and SDK/product improvement; and
- security, abuse detection, and fraud prevention.

Do not call IP-derived location “precise location.” Google describes it as
general/approximate location. trizum should not request or send GPS, Wi-Fi, or
cell-derived precise location to advertising.

### 4. Recipients and links

- Name Google and link to Google's partner-data explanation, privacy policy, and
  display-advertising disclosure.
- Explain that Google can involve the advertising/ad-technology partners shown
  in the UMP message and that the exact parties can depend on consent and AdMob
  configuration.
- State that no separately integrated mediation networks are used in this
  rollout.
- Keep Apple's required assurance that third parties receiving app data provide
  the same or equal protection required by the policy and App Review Guidelines.

### 5. Choices and legal bases

- For EEA, UK, and Swiss users, explain that UMP asks for legally required
  choices before personalized advertising. Google's policy requires consent for
  cookies/local storage where legally required and for collection, sharing, and
  use of personal data for ad personalization; it also requires records of
  consent and clear revocation instructions. [Google EU User Consent
  Policy](https://www.google.com/about/company/user-consent-policy/)
- State the actual lawful basis for every remaining advertising purpose, matching
  the configured UMP vendor/purpose list. Do not use a blanket “by using trizum,
  you consent” statement. Whether a non-personalized purpose relies on consent or
  legitimate interests is a configuration/legal determination, not something to
  guess in product copy.
- Explain that applicable US users can opt out of sale/sharing or ad
  personalization using the Privacy options entry point.
- Explain that ATT is a separate Apple permission for cross-app/site tracking and
  IDFA access. Denial means the Google Mobile Ads SDK does not send IDFA, but ads
  may still be requested. [Google — Present IDFA
  message](https://developers.google.com/admob/ios/privacy/idfa)
- Explain how to reopen Privacy options when UMP requires it, how to change ATT
  in iOS Settings, and link to Google's ad controls where useful.

### 6. Retention, security, and international transfers

- State what trizum retains locally for ad operation (for example, the
  installation-local first-use marker and last full-screen-ad timestamp) and
  that it is deleted when app storage is cleared or the app is uninstalled.
- If sanitized AdMob SDK errors are sent to Sentry, say so under diagnostics and
  retain the existing Sentry disclosure. Do not record consent choices,
  advertising IDs, ad-response payloads, or trizum domain/account data in those
  events.
- State that Google retains advertising information under its published
  policies, rather than inventing a single fixed duration. Google's published
  explanation includes differing retention periods by data and purpose.
  [Google — How Google retains data](https://policies.google.com/technologies/retention)
- Explain that Google operates globally and identify the actual transfer
  safeguards applicable to the AdMob agreement. Google describes its use of
  adequacy decisions, the EU-US/Swiss-US Data Privacy Framework and UK Extension,
  and Standard Contractual Clauses where required. [Google — Legal frameworks
  for data transfers](https://policies.google.com/privacy/frameworks)

The existing policy's statement that users consent to international transfers
merely by using the Service should be revisited. The policy should disclose the
actual transfer mechanism; consent to use the app is not a substitute for naming
that mechanism.

### 7. Children and updates

- Retain the existing statement that trizum is intended for adults aged 18 and
  older.
- Keep AdMob configured as not child-directed and not under the age of consent,
  consistent with store audience declarations.
- Update the policy's effective/last-updated date and describe material changes
  before live ad serving begins.

## Separate deliverables that the privacy policy does not replace

### Google Play Data Safety

Data Safety is a separate Play Console declaration and must remain consistent
with the privacy policy. Google says developers are responsible for the answers
and must account for their whole app, while its SDK disclosure covers only the
current Mobile Ads SDK. [Google Play — Data Safety
requirements](https://support.google.com/googleplay/android-developer/answer/10787469)

For AdMob, review at least the SDK's automatic collection/sharing of IP-derived
general location, product interactions, diagnostics, and device/account
identifiers for advertising, analytics, and fraud prevention. Confirm the exact
checkbox mapping against the SDK version resolved by the Capacitor plugin at
release time. Also update the answer if Android advertising-ID collection or any
optional feature is enabled. [Google Mobile Ads SDK — Google Play data
disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)

### Apple App Privacy labels and privacy manifest

App Store Connect requires a separate label covering the app and all third-party
SDKs. Apple's definition of “collect” includes third-party partners, and Apple
requires disclosure across variants such as consent state or paid/free status;
data collected only from some users cannot simply be omitted. [Apple — App
Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

Based on Google's SDK disclosure, review at least Coarse Location (IP-derived),
Crash Data, Performance Data, Device ID, Advertising Data, and Product
Interaction, with their actual purposes and whether they are linked to the user
or used for tracking. Because trizum plans to request ATT and use IDFA when
granted, the label will likely need to disclose tracking for the relevant data
types. Final selections must come from the resolved SDK version, Xcode privacy
report/manifest, and actual configuration; Google's page explicitly leaves the
developer responsible. The Google Mobile Ads SDK includes a privacy manifest in
version 11.2.0 and later, but that manifest does not complete App Store Connect
answers automatically. [Google Mobile Ads SDK — App Store data
disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure)

### UMP consent and privacy-options UI

The privacy policy is notice, not the consent mechanism.

Existing installations upgrading to the first ad-enabled release should be
treated like new installations: the absence of local ad-history state starts a
First-Use Session in which the Mobile Ads SDK, UMP, ATT, and ads remain inactive
until the app has subsequently been inactive for 30 minutes.

- Configure and publish European regulation messages in AdMob. Personalized ads
  in the EEA, UK, and Switzerland require a Google-certified CMP integrated with
  the IAB TCF; Google's UMP/CMP is the selected solution. [Google CMP
  requirements](https://support.google.com/admanager/answer/16918505)
- Request a consent-info update on eligible launches, present the required form,
  and request ads only when UMP reports `canRequestAds`. [Google UMP for
  Android](https://developers.google.com/admob/android/privacy), [Google UMP for
  iOS](https://developers.google.com/admob/ios/privacy)
- Outside jurisdictions where UMP reports that no consent or opt-out message is
  required, do not add a separate trizum consent prompt; rely on UMP's
  jurisdiction-aware result together with platform and device privacy settings.
- Render a visible, interactive Privacy options control whenever UMP reports it
  as required. Google documents European consent revocation and US state
  opt-out messages at that entry point. [Google — Available user message
  types](https://support.google.com/admob/answer/10114020) Use the localized
  label “Privacy and cookie settings” in English and “Privacidad y configuración
  de cookies” in Spanish.
- Configure the US message for all current and future supported states if that is
  the intended coverage. [Google — Create a US state regulations
  message](https://support.google.com/admob/answer/10860309)

UMP helps implement choices but does not by itself guarantee legal compliance;
the message, partner list, policy, SDK gating, and store declarations must agree.

### iOS ATT and `Info.plist`

ATT is separate from the privacy policy and UMP regulatory consent. If the app
calls ATT, `NSUserTrackingUsageDescription` must contain a short, specific custom
purpose string before tracking occurs. [Apple —
`NSUserTrackingUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsusertrackingusagedescription)

The currently agreed localized purpose text is:

- English: “trizum uses this permission to show more relevant ads and measure ad
  performance. You can continue using the app if you decline.”
- Spanish: “trizum usa este permiso para mostrar anuncios más relevantes y medir
  su rendimiento. Puedes seguir usando la app si lo rechazas.”

The UMP IDFA explainer must be created in AdMob and shown before Apple's one-time
ATT alert. Denial does not prevent ad requests, but the SDK does not send IDFA.
[Google — Present IDFA message](https://developers.google.com/admob/ios/privacy/idfa)

The AdMob app ID, SKAdNetwork entries, and the AppTrackingTransparency framework
are also native configuration work, not privacy-policy prose.

### App Open startup boundary

For a cold launch, begin loading an App Open ad only after Ad Eligibility and Ad
Consent are resolved. It may appear only if ready before the app reaches its
first interactive screen; never hold or extend the splash for it. Once that
screen is ready, the opportunity expires. On a qualifying warm return after 30
minutes of inactivity, present only an App Open ad that was already prepared. If
UMP or Apple's ATT alert is actually presented during a launch, expire that
launch's App Open opportunity rather than placing an ad immediately after the
privacy interface. This does not suppress otherwise-eligible Interstitial
Opportunities later in the session.

### AdMob console and release checklist

Before live ad serving:

- add the public privacy-policy URL to both apps' Privacy & messaging
  configuration; Google requires it for European messages
  ([AdMob — Add a privacy policy URL](https://support.google.com/admob/answer/10113106));
- publish the European, supported-US-state, and iOS IDFA messages and verify their
  languages, partner lists, and links;
- select only intended ad technology/demand partners and verify the UMP vendor
  list matches the policy;
- verify publisher first-party ID remains governed by the configured privacy
  signals while optional first-party-data enrichment and third-party identifier
  sharing remain disabled;
- keep mediation and separately integrated mediation SDKs disabled;
- keep Android's delayed app-measurement manifest flag enabled so including the
  SDK does not start measurement before the coordinator resolves eligibility
  and consent;
- configure the app as not child-directed/not under age of consent and enforce
  the chosen PG maximum content rating;
- link each app to its production store record and complete AdMob app-readiness
  review; and
- keep `app-ads.txt` verified for the same public publisher ID.

## Release verification

Immediately before the release that enables live ads:

1. inspect the exact native Google Mobile Ads and UMP versions resolved by the
   Capacitor plugin;
2. re-check Google's Android and iOS data-disclosure pages, because Google says
   the SDK and required disclosures change over time;
3. capture Android network traffic and the iOS Xcode privacy report to verify the
   written boundary and store labels;
4. verify publisher first-party ID is consistently enabled in the SDK and
   AdMob, and verify the prohibited enrichment and sharing features remain off;
5. test European consent, US opt-out, iOS ATT allow/deny, Premium/ad-free,
   unknown entitlement, and UMP failure paths using test ads;
6. confirm the in-app Privacy options entry appears exactly when UMP requires it;
7. ensure privacy-policy, Play Data Safety, App Privacy labels, ATT purpose text,
   UMP messages, and actual network behavior are consistent; and
8. block selection of the live-ad configuration until a focused legal review
   approves the final legal-basis, transfer, and US sale/sharing language based
   on the actual UMP vendor configuration and store disclosures.
