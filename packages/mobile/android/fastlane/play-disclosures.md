# Google Play disclosures

Google Play's app-content declarations are separate from listing metadata and
binary uploads. A successful production upload does not establish that these
declarations are current, submitted for review, or published.

## Updating Data safety

The pinned Fastlane `upload_to_play_store` action manages listings, screenshots,
and releases; it has no Data safety option. Its bundled
`google-apis-androidpublisher_v3` client does support Google's
[`applications.dataSafety` endpoint](https://developers.google.com/android-publisher/api-ref/rest/v3/applications/dataSafety).
The separate `upload_data_safety` lane uses that client and Supply's existing
Appfile authentication, including `GOOGLE_PLAY_JSON_KEY_FILE`.

1. Review the existing Play Console answers against the released binary, app
   data flows, SDK guidance, and deployed deletion behavior. Preserve correct
   answers. The form covers the whole app, including its controlled WebView.
2. Complete and review the questionnaire in Play Console. Export the complete
   Google CSV once and retain it as `fastlane/data_safety.csv` after resolving
   all outstanding declarations. This repository currently has no finalized
   CSV: the audit below is a draft with unresolved deletion and review access.
3. To upload a reviewed CSV using the existing service account:

   ```bash
   cd packages/mobile/android
   mise exec -- bundle exec fastlane upload_data_safety \
     csv:"$PWD/fastlane/data_safety.csv"
   ```

The lane checks that the file exists and parses as a nonempty CSV. It does not
validate the truth or completeness of answers. The API accepts the complete CSV,
not a partial patch, and exposes no dry-run option. This is a separate write
outside a release edit; `release_status: draft` and Supply's `validate_only` do
not protect it. Do not add the lane to automatic release uploads.

After a successful upload, inspect Play Console's Data safety status and
Publishing overview. API success alone does not prove public availability.
Do not submit unrelated queued release/listing changes while updating disclosures.
Contains ads, Advertising ID, privacy-policy URL, and sign-in instructions still
need their own Console review. Keep reviewer credentials out of Git and logs.

## Android 1.13.0 audit — 26 October 2026

Scope: `app.trizum.capacitor`, version `1.13.0`, version code `10130000`, release
commit `298e62b9987fac8414c3dad731daee3f8e6dc532`.
The [release run](https://github.com/HorusGoul/trizum/actions/runs/40246050764)
and [release assets](https://github.com/HorusGoul/trizum/releases/tag/%40trizum/mobile%401.13.0)
were checked independently of the Console declarations.

### Shipped artifacts

| Artifact | SHA-256 |
| --- | --- |
| `trizum-mobile-1.13.0-signed.apk` | `f2b214be5fceff86adabd2e2f1c1422f548c9dd0ad0ab7491d8a321bddd16ed0` |
| `trizum-mobile-1.13.0-signed.aab` | `324f81dbe46b04391a92b0a3eb8f3822268af4a0c6bcd337888d5d8956971ef2` |

Both final manifests declare min SDK 24 and target SDK 36. They contain
`com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_AD_ID`,
`ACCESS_ADSERVICES_ATTRIBUTION`, and `ACCESS_ADSERVICES_TOPICS`, as well as
Internet, camera, network-state, billing, biometric/fingerprint, wake-lock,
foreground-service, and the app's protected receiver permission. Neither requests
Android location or contacts permissions. IP-derived approximate location still
requires disclosure; permissions alone do not describe collection.

The APK's SDK properties identify Google Mobile Ads 24.9.0, UMP 4.0.0, and Play
Billing 8.3.0. `DELAY_APP_MEASUREMENT_INIT=true` is present in both manifests.
The packaged JavaScript contains the production Android ad-unit IDs and
`wss://server.trizum.app/sync`. RevenueCat's packaged configuration disables
automatic device identifier collection and enables diagnostics. No binary change
is needed to retain the already-merged AD_ID permission.

To repeat the AAB check with Google's bundletool:

```bash
java -jar /path/to/bundletool.jar dump manifest \
  --bundle=/path/to/trizum-mobile-1.13.0-signed.aab --module=base
```

### Console findings and saved changes

| Declaration | Before audit | Audit result |
| --- | --- | --- |
| Contains ads | No | Changed to Yes; saved, not submitted |
| Advertising ID | Yes; advertising/marketing only | Retained Yes and added analytics and fraud prevention/security/compliance; saved |
| Missing-AD_ID release safeguard | Enabled | Preserved; bypass remains unchecked |
| Data safety | Last edited 11 December 2025; six data types | Expanded draft described below; not submitted |
| Account creation | App does not allow account creation | Draft now declares password, magic-link/other authentication, and OAuth |
| Encryption in transit | Yes | Preserved; HTTPS/WSS and SDK TLS support it; this does not mean end-to-end encryption |
| Data-deletion request answer | No | No broader deletion claim added; separate remediation pending |
| Privacy-policy URL | `https://trizum.app/privacy-policy` | Preserved; publicly accessible and already describes AdMob, RevenueCat, account data, analytics, and diagnostics |
| Sign-in details / App access | No restricted areas; no reviewer credentials | Incorrect for cloud sign-in and Premium; completion requires a dedicated reviewer login |

The Console confirmed that the Data safety draft was saved. Ads appeared under
changes not yet submitted for review; Advertising ID appeared under "What you've
told us". No review submission or publication was performed by this audit.

The public Play listing still showed no Contains ads label, "No data shared
with third parties", the original three data categories, and "Data can't be
deleted". The expanded questionnaire is a saved draft, not the public label.

### Data safety draft

All listed collection is non-ephemeral. "Required" applies to the entire data
type across the app, not merely one SDK or the optional analytics setting.

Purpose abbreviations below: **F** app functionality; **A** analytics; **Ads**
advertising or marketing; **S** fraud prevention, security and compliance;
**Account** account management. These are Google Play purposes.

| Data type | Collection | Sharing | Collected for | Shared for | Change |
| --- | --- | --- | --- | --- | --- |
| Name | Optional | No | F | — | Preserved |
| Email address | Optional | No | F, S, Account | — | Added for cloud authentication |
| User IDs | Required | No | F, A, S, Account | — | Retained required collection; added account, purchase/telemetry, and security purposes |
| Phone number | Optional | No | F | — | Preserved |
| Purchase history | Required | No | F, A | — | Added for expense transactions and RevenueCat purchase records |
| Other financial info | Required | No | F | — | Added for balances and debts |
| Approximate location | Required | Yes | A, Ads, S | A, Ads, S | Added for AdMob IP-derived location |
| Photos | Optional | No | F | — | Preserved |
| Crash logs | Required | No | F, A | — | Retained functionality; added analytics for error diagnosis |
| Diagnostics | Required | Yes | F, A, Ads, S | A, Ads, S | Added AdMob sharing and purposes; includes Sentry and enabled RevenueCat diagnostics |
| App interactions | Required | Yes | A, Ads, S | A, Ads, S | Added for AdMob and app telemetry |
| Other user-generated content | Optional | No | F | — | Added for descriptions and other free text |
| Device or other IDs | Required | Yes | F, A, Ads, S | A, Ads, S | Added for SDK identifiers and app/sync identifiers |

No payment-card collection, precise location, contacts permission, independent
security certification, or automatic 90-day deletion is inferred. Photos and
user-initiated collaborative sharing retain the existing non-sharing answer
under Google's user-initiated-transfer exception. Service-provider processing
is collection, but is not automatically "sharing" in Google's taxonomy. Check
RevenueCat integrations if downstream destinations change.

AdMob collection is not globally optional merely because UMP provides regional
choices or Android lets users delete the advertising ID: other ad-request data
and identifiers can remain. Premium suppresses ads and unknown entitlements
suppress SDK loading; unavailable billing/ads must not block ordinary app use.
The usage-analytics opt-out does not disable Sentry diagnostics. Expense and
shared-document sync also operates without cloud sign-in, so anonymous use is
not evidence of local-only processing.

### Outstanding deletion and review-access work

The draft's required account-deletion URL remains unresolved. The deployed
`packages/pwa/api/auth.ts` deletion hook removes cloud settings alongside the
authentication account. It does not delete a RevenueCat customer. SDK logout is
not customer deletion. Removing a party in `usePartyList.ts` only removes the
list reference; it does not erase the shared party document or its history.
Do not claim that these operations delete all associated data, or delete other
participants' collaborative data as part of this disclosure work.

The live policy describes cloud account deletion and retention limits, but does
not establish an implemented cross-provider erasure procedure. Its general
"regular security assessments" wording is not evidence of Google's independent
security-review badge. A separate account-deletion change is pending; update
the URL and answers only after the deployed behavior and retention explanation
are verified. Deleting a RevenueCat customer is also not a subscription
cancellation or refund.

App Store Connect's actual review-detail records for both submitted 1.13.0 and
released 1.12.2 contained no reviewer username or password. They were inspected
read-only. Public local expense use needs no account; cloud sign-in and purchase
flows need a dedicated account. Do not assume that a cloud account is Premium.
Google says reviewers cannot create accounts, use their own payment accounts,
or rely on a free trial. If full Premium feature review needs an entitlement,
resolve that separately without granting one as an incidental disclosure edit.

### Evidence to revisit when behavior changes

- App flows: `packages/pwa/src/lib/advertising/advertisingCoordinator.ts`,
  `adMobSdk.ts`, `packages/pwa/src/components/PremiumProvider.tsx`,
  `packages/pwa/src/lib/premium/revenueCatClient.ts`, `packages/pwa/src/main.tsx`,
  `packages/pwa/src/models/party.ts`, `expense.ts`, and
  `packages/pwa/src/routes/privacy-policy.tsx`.
- [Google AdMob Android disclosure guide](https://developers.google.com/admob/android/privacy/play-data-disclosure):
  the current page describes SDK 25.5.0; the inspected release ships 24.9.0.
  The guide is a disclosure baseline, not evidence that this app ships 25.5.0.
- [Google Play Data safety definitions and CSV workflow](https://support.google.com/googleplay/android-developer/answer/10787469).
- [Advertising ID and merged library permissions](https://support.google.com/googleplay/android-developer/answer/6048248).
- [Contains ads, privacy policy, and review access](https://support.google.com/googleplay/android-developer/answer/9859455).
- [Account and associated-data deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
- [RevenueCat's Google Play Data safety guidance](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety):
  purchase history is collected for functionality and analytics; its generic
  diagnostics statement does not override this app's enabled SDK diagnostics.
- [Fastlane Supply](https://docs.fastlane.tools/actions/upload_to_play_store/)
  and the pinned Android Fastlane/Gemfile.lock, inspected for existing support
  before adding the separate lane. Prior Android privacy-related Git history
  updated listing copy, not the Data safety questionnaire.
