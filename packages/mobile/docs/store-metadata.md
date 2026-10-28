# Store metadata and privacy

[Back to package overview](../README.md). Read when changing store listings, screenshots, or privacy disclosures. File paths below are relative to `packages/mobile`. Run each command block from the repository root; subshells select the iOS bundle without changing your shell's working directory.

## App Store Metadata (iOS)

App Store listing content is managed in code via Fastlane's [deliver](https://docs.fastlane.tools/actions/deliver/) tool. All metadata files are located in `ios/App/fastlane/metadata/`.

### Directory Structure

```
ios/App/fastlane/
├── metadata/
│   ├── copyright.txt              # Copyright notice
│   ├── primary_category.txt       # Primary App Store category
│   ├── secondary_category.txt     # Secondary category (optional)
│   ├── en-US/                     # English (US) locale
│   │   ├── name.txt               # App name (max 30 chars)
│   │   ├── subtitle.txt           # Subtitle (max 30 chars)
│   │   ├── description.txt        # Full description (max 4000 chars)
│   │   ├── keywords.txt           # Keywords, comma-separated (max 100 chars)
│   │   ├── promotional_text.txt   # Promotional text (max 170 chars)
│   │   ├── release_notes.txt      # What's new
│   │   ├── marketing_url.txt      # Developer website URL
│   │   ├── support_url.txt        # Support URL
│   │   └── privacy_url.txt        # Privacy policy URL (required)
│   └── review_information/        # App Review contact info
│       ├── first_name.txt
│       ├── last_name.txt
│       ├── email_address.txt
│       ├── phone_number.txt
│       └── notes.txt              # Notes for reviewer
├── screenshots/                   # App Store screenshots (by locale/device)
│   └── en-US/
│       └── *.png
├── rating_config.json             # Age rating configuration
├── app_privacy_details.json       # App Privacy questionnaire answers
└── Deliverfile                    # Deliver configuration
```

### Adding Locales

To add a new locale (e.g., German), create a new directory and add the same files:

```bash
mkdir -p packages/mobile/ios/App/fastlane/metadata/de-DE
# Copy and translate files from en-US
```

### Updating Metadata

Edit the text files in `ios/App/fastlane/metadata/`, then upload them:

```bash
(cd packages/mobile/ios/App && mise exec -- bundle exec fastlane upload_metadata)
```

Changes to `promotional_text.txt` don't require a new app version.

### App Privacy Questionnaire

`ios/App/fastlane/app_privacy_details.json` is the complete set of App Privacy
answers maintained for publication in App Store Connect. Fastlane's `deliver` uploads the privacy
policy URL, but does not upload these questionnaire answers. Use the dedicated
[App Privacy action](https://docs.fastlane.tools/uploading-app-privacy-details/)
through this lane when the answers change:

```bash
(cd packages/mobile/ios/App && mise exec -- bundle exec fastlane upload_privacy)
```

This action requires an Apple ID login (`FASTLANE_USER`, with two-factor
authentication or an existing `FASTLANE_SESSION`). The pinned Fastlane action
does not support App Store Connect API-key authentication, so it runs separately
from the API-key-based release workflow. It replaces all questionnaire answers
and publishes them immediately; keep the JSON complete when updating it.
Regular metadata and binary uploads do not overwrite the questionnaire.

The answers retain the existing app disclosures and include AdMob's Device ID,
coarse location, advertising data, product interaction, and diagnostic uses.
Device IDs are linked to the user and used for tracking when permission allows;
the other AdMob tracking flags follow its installed privacy manifest. Account
email is linked to the user for authentication (app functionality). User IDs
also cover the persistent telemetry identifier used for analytics. Purchases
are linked to the user for app functionality and RevenueCat analytics because
the RevenueCat client uses the signed-in account's ID. No payment-card details
are collected by the app. RevenueCat's [Apple App Privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
requires both purchase purposes. [Apple's definitions](https://developer.apple.com/app-store/app-privacy-details/)
cover account email and user-level identifiers.

Repository changes take effect in App Store Connect when the privacy lane is
run. Verify the published answers after uploading.

Review these answers when SDKs or data flows change. The current advertising
disclosures follow Google's [iOS data disclosure guide](https://developers.google.com/admob/ios/privacy/data-disclosure)
and the Google Mobile Ads SDK's `PrivacyInfo.xcprivacy`. Existing linked crash
and performance disclosures are retained for the app's own diagnostics.
Developer advertising is not selected because trizum does not run first-party
advertising or marketing through the SDK. The `Deliverfile` IDFA declaration
must remain consistent with `app_store_submission_information` in `Fastfile`.

### Screenshots

Add screenshots to `ios/App/fastlane/screenshots/en-US/` with naming convention:

- `iPhone 6.9" Display-1_expense-log.png`
- `iPad 13" Display-1_expense-log.png`

Upload screenshots with:

```bash
(cd packages/mobile/ios/App && mise exec -- bundle exec fastlane upload_screenshots)
```

The iOS lanes synchronize screenshots by locale, filename, and checksum. This
makes reruns safe: screenshots missing locally are removed from App Store
Connect, unchanged screenshots are not uploaded again, and each device set is
reordered from the numeric filename prefix. The beta Fastlane synchronization
path is wrapped with the same five-minute processing limit as the legacy
uploader.
