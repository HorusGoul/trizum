# trizum mobile

Capacitor-based mobile application for trizum.

Read the repo [AGENTS guide](../../AGENTS.md) first. This document is the
package-level entry point for native wrapper and store-distribution work.

## Overview

This package wraps the PWA (`@trizum/pwa`) as a native mobile application using [Capacitor](https://capacitorjs.com/). It provides native functionality and distribution via the App Store and Google Play.

## Prerequisites

- **Vite+ (`vp`)** for the repo-managed Node.js and package manager versions
- **For iOS:**
  - macOS with Xcode 15+
  - CocoaPods from the iOS bundle
  - Apple Developer account (for device testing/distribution)
- **For Android:**
  - Android Studio with SDK 35
  - Java 17+
- **Fastlane** (for automated builds), installed through the native bundles

## Getting Started

### Initial Setup

```bash
# From repo root
vp install
vp run --filter @trizum/pwa build
```

### Native Ruby Environment

`vp run build` runs Capacitor sync. On macOS, Capacitor uses the iOS
`Gemfile.lock` to run `bundle exec pod install`, so use the repo mise config to
match the Ruby version used by CI:

```bash
# From repo root
mise trust
mise install
mise exec -- gem install bundler:2.7.2
(cd packages/mobile/ios/App && mise exec -- bundle install)

cd packages/mobile
vp run build
```

The Android and iOS Gemfile directories contain `mise.toml` symlinks to the
workspace root config so CI `ruby/setup-ruby` resolves the same Ruby version
while installing package-local bundles.

### Development

For live development with hot reload:

1. Create a `.env` file in `packages/mobile`:

```bash
DEV_URL=http://YOUR_LOCAL_IP:5173
```

2. Start the PWA dev server:

```bash
cd packages/pwa
vp run dev -- --host
```

3. Run on device/simulator:

```bash
cd packages/mobile
vp run dev:android  # For Android
vp run dev:ios      # For iOS
```

### Opening in IDEs

```bash
vp run open:android  # Opens in Android Studio
vp run open:ios      # Opens in Xcode
```

## Project Structure

```
packages/mobile/
├── android/              # Android native project
│   ├── app/              # Main Android app module
│   ├── fastlane/         # Fastlane configuration for Android
│   └── Gemfile           # Ruby dependencies for fastlane
├── ios/
│   └── App/              # iOS native project
│       ├── App/          # Main iOS app
│       ├── fastlane/     # Fastlane configuration for iOS
│       │   ├── Appfile           # App identifier config
│       │   ├── Fastfile          # Lane definitions
│       │   ├── Deliverfile       # App Store delivery config
│       │   ├── metadata/         # App Store listing content
│       │   ├── screenshots/      # App Store screenshots
│       │   └── rating_config.json # Age rating
│       └── Gemfile       # Ruby dependencies for fastlane
├── dist/                 # Copied PWA assets (gitignored)
├── assets/               # Source assets (icons, splash screens)
├── capacitor.config.ts   # Capacitor configuration
└── package.json
```

## Scripts

| Script            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `build`           | Copy PWA assets and sync Capacitor                     |
| `check`           | Run package validation                                 |
| `open:android`    | Open Android project in Android Studio                 |
| `open:ios`        | Open iOS project in Xcode                              |
| `run:android`     | Build and run on Android device/emulator               |
| `run:ios`         | Build and run on iOS device/simulator                  |
| `dev:android`     | Run in dev mode with live reload (Android)             |
| `dev:ios`         | Run in dev mode with live reload (iOS)                 |
| `assets:generate` | Generate app icons and splash screens                  |
| `sync:check`      | Fail if Capacitor sync changes mobile files            |
| `check:android`   | Validate Android sync, lint, tests, APK, and AAB build |
| `ruby:check`      | Dry-run Ruby bundles used by mobile CI                 |

## Fastlane

This project uses [Fastlane](https://fastlane.tools/) for automated builds and deployments.

### Setup

```bash
# Install Ruby dependencies for Android
cd packages/mobile/android
bundle install

# Install Ruby dependencies for iOS
cd packages/mobile/ios/App
bundle install
```

### Available Lanes

#### Android (`packages/mobile/android`)

| Lane                | Description                         |
| ------------------- | ----------------------------------- |
| `build_debug`       | Build debug APK                     |
| `build_release`     | Build release APK (signed)          |
| `build_aab`         | Build release AAB for Play Store    |
| `deploy_internal`   | Upload to Play Store internal track |
| `deploy_beta`       | Upload to Play Store beta track     |
| `deploy_production` | Upload to Play Store production     |

```bash
cd packages/mobile/android
bundle exec fastlane build_debug
bundle exec fastlane build_release
```

Dry-run the Android Ruby pipeline without building or uploading:

```bash
cd packages/mobile
vp run ruby:check:android
```

#### iOS (`packages/mobile/ios/App`)

**Build Lanes:**

| Lane            | Description                       |
| --------------- | --------------------------------- |
| `build_debug`   | Build debug app for simulator     |
| `build_release` | Build release IPA for App Store   |
| `build_adhoc`   | Build ad-hoc IPA for distribution |

**Deployment Lanes:**

| Lane                     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `deploy_testflight`      | Build and upload to TestFlight                   |
| `deploy_testflight_full` | Build, upload to TestFlight, and update metadata |
| `deploy_appstore`        | Build and upload to App Store (binary only)      |
| `deploy_appstore_full`   | Build and upload with metadata (full deployment) |
| `submit_review`          | Submit existing build for App Store review       |

**Metadata Lanes:**

| Lane                 | Description                                       |
| -------------------- | ------------------------------------------------- |
| `download_metadata`  | Download existing metadata from App Store Connect |
| `upload_metadata`    | Upload metadata only (no build)                   |
| `upload_screenshots` | Upload screenshots only                           |

**Utility Lanes:**

| Lane              | Description                            |
| ----------------- | -------------------------------------- |
| `bump_version`    | Increment version (patch/minor/major)  |
| `set_version`     | Set specific version number            |
| `current_version` | Print current version and build number |

```bash
cd packages/mobile/ios/App

# Build
bundle exec fastlane build_debug
bundle exec fastlane build_release

# Deploy to TestFlight
bundle exec fastlane deploy_testflight

# Full App Store deployment with metadata
bundle exec fastlane deploy_appstore_full

# Full deployment and submit for review
bundle exec fastlane deploy_appstore_full submit_for_review:true

# Auto-release after approval
bundle exec fastlane deploy_appstore_full submit_for_review:true automatic_release:true

# Update metadata only (no new build)
bundle exec fastlane upload_metadata

# Download existing metadata from App Store Connect
bundle exec fastlane download_metadata
```

Dry-run the iOS Ruby pipeline without signing, building, or uploading:

```bash
cd packages/mobile
vp run ruby:check:ios
```

### App Store Metadata (iOS)

App Store listing content is managed in code via Fastlane's [deliver](https://docs.fastlane.tools/actions/deliver/) tool. All metadata files are located in `ios/App/fastlane/metadata/`.

#### Directory Structure

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
└── Deliverfile                    # Deliver configuration
```

#### Adding Locales

To add a new locale (e.g., German), create a new directory and add the same files:

```bash
mkdir -p ios/App/fastlane/metadata/de-DE
# Copy and translate files from en-US
```

#### Updating Metadata

1. Edit the text files in `metadata/`
2. Run `bundle exec fastlane upload_metadata` to push changes
3. Changes to `promotional_text.txt` don't require a new app version

#### Screenshots

Add screenshots to `ios/App/fastlane/screenshots/en-US/` with naming convention:

- `iPhone 6.7-Inch Display-1.png` (iPhone 15 Pro Max, etc.)
- `iPhone 6.5-Inch Display-1.png` (iPhone 11 Pro Max, etc.)
- `iPhone 5.5-Inch Display-1.png` (iPhone 8 Plus, etc.)
- `iPad Pro 12.9-Inch Display-1.png`

Run `bundle exec fastlane upload_screenshots` to upload.

### Environment Variables

#### Android

| Variable                    | Description                              |
| --------------------------- | ---------------------------------------- |
| `ANDROID_KEYSTORE_FILE`     | Path to the release keystore file        |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                        |
| `ANDROID_KEY_ALIAS`         | Key alias in the keystore                |
| `ANDROID_KEY_PASSWORD`      | Key password                             |
| `GOOGLE_PLAY_JSON_KEY_FILE` | Path to Google Play service account JSON |

#### iOS

| Variable                                | Description                                    |
| --------------------------------------- | ---------------------------------------------- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`   | Base64-encoded distribution certificate (.p12) |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Password for the .p12 certificate              |
| `IOS_PROVISIONING_PROFILE_BASE64`       | Optional base64-encoded provisioning profile   |
| `IOS_REFRESH_PROVISIONING_PROFILE`      | Set to `true` to refresh the App Store profile |
| `APP_STORE_CONNECT_API_KEY_ID`          | App Store Connect API Key ID                   |
| `APP_STORE_CONNECT_API_ISSUER_ID`       | App Store Connect API Issuer ID                |
| `APP_STORE_CONNECT_API_KEY_CONTENT`     | Base64-encoded App Store Connect API Key (.p8) |

## GitHub Actions

The `CI` workflow includes a `Check Android` job that performs an Android
Capacitor sync check, then runs Gradle lint, unit tests, debug APK assembly, and
release AAB bundling without Play Store or release signing credentials. Use
this as the required dry-run for Gradle, Android Gradle Plugin, SDK, or native
Android project changes.

A `workflow_dispatch` workflow is available for building mobile apps in CI. Navigate to **Actions > Mobile Build** in GitHub and select:

- **Platform**: `android`, `ios`, or `both`
- **Build type**: `debug` or `release`
- **Android artifact**: `apk` or `aab` (for release builds)
- **iOS export method**: `app-store` or `ad-hoc` (for release builds)

Add the `android:internal-testing` label to a non-fork pull request to build
signed Android APK and AAB artifacts from the PR head, upload the AAB to the
Google Play internal testing track, and comment on the PR with links to both
artifacts. The workflow computes a temporary Android `versionCode` from the
highest version code already present in Play Store tracks and fails before it
reaches the next release version-code range, so PR uploads do not silently block
the next production patch release. After a successful internal release and PR
comment, the workflow removes the label.

Add the `ios:testflight` label to a non-fork pull request to build a signed iOS
release from the PR head and upload it to TestFlight. The workflow computes a
temporary iOS version/build pair from the next patch TestFlight train, then
fails before it reaches the following patch's build-number range. This avoids
uploading to a released App Store train that App Store Connect has already
closed for new pre-release builds. After a successful TestFlight upload, the
workflow comments on the PR with the TestFlight version/build details and
removes the label.

Published, non-prerelease GitHub releases tagged as `@trizum/mobile@*` also
trigger the shared release workflow. That path reuses the mobile build and
store deployment workflows to generate store screenshots, publish Android to the
Play Store production track with `release_status` `completed`, submit iOS to
App Store review with immediate rollout and `automatic_release` enabled, and
attach the signed Android APK and AAB to the GitHub release.

### Required Secrets

Configure these secrets in your GitHub repository settings (**Settings → Secrets and variables → Actions**):

#### Android Secrets

| Secret                        | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`     | Base64-encoded release keystore                 |
| `ANDROID_KEYSTORE_PASSWORD`   | Keystore password                               |
| `ANDROID_KEY_ALIAS`           | Key alias                                       |
| `ANDROID_KEY_PASSWORD`        | Key password                                    |
| `GOOGLE_PLAY_JSON_KEY_BASE64` | Base64-encoded Google Play service account JSON |

**How to get Android secrets:**

```bash
# Encode your keystore file
base64 -i your-release.keystore | tr -d '\n'
```

#### iOS Secrets

| Secret                                     | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`      | Base64-encoded distribution certificate (.p12)        |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`    | Password used when exporting the .p12                 |
| `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64` | Optional fallback App Store provisioning profile      |
| `IOS_ADHOC_PROVISIONING_PROFILE_BASE64`    | Base64-encoded Ad Hoc provisioning profile (optional) |
| `APP_STORE_CONNECT_API_KEY_ID`             | App Store Connect API Key ID                          |
| `APP_STORE_CONNECT_API_ISSUER_ID`          | App Store Connect API Issuer ID                       |
| `APP_STORE_CONNECT_API_KEY_CONTENT`        | Base64-encoded API Key content (.p8 file)             |

### How to Get iOS Secrets

#### 1. Export Distribution Certificate (.p12)

The distribution certificate is used to sign your app for App Store or Ad Hoc distribution.

1. Open **Keychain Access** on your Mac
2. In the sidebar, select **login** keychain and **My Certificates** category
3. Find your **Apple Distribution** certificate (or **iPhone Distribution** for older certs)
4. Right-click → **Export** → Save as `.p12` file
5. Set a password when prompted (this becomes `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`)
6. Encode the certificate:

```bash
base64 -i Certificates.p12 | tr -d '\n'
```

> **Note:** If you don't have a distribution certificate, create one in [Apple Developer Portal → Certificates](https://developer.apple.com/account/resources/certificates/list).

#### 2. Provisioning Profiles

Provisioning profiles link your app ID, certificate, and (for Ad Hoc) device UDIDs.
The App Store and TestFlight workflows refresh the App Store provisioning
profile in CI with the App Store Connect API key so the profile stays aligned
with native entitlements such as Associated Domains and Sign in with Apple.

1. Go to [Apple Developer Portal → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Find (or create) your **Ad Hoc** provisioning profile, or an **App Store**
   profile only when using `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64` as a
   manual fallback
3. Click **Download** to get the `.mobileprovision` file
4. Encode the profile:

```bash
base64 -i YourProfile.mobileprovision | tr -d '\n'
```

> **Tip:** You can also find downloaded profiles at `~/Library/MobileDevice/Provisioning Profiles/`

#### 3. Create App Store Connect API Key

The API key is used for uploading to TestFlight/App Store and accessing Apple services without 2FA.

1. Go to [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Click **Generate API Key**
3. Name it (e.g., "CI/CD") and select **Admin** or **App Manager** role
4. Note the **Key ID** (e.g., `ABC123XYZ`) → `APP_STORE_CONNECT_API_KEY_ID`
5. Note the **Issuer ID** at the top of the page → `APP_STORE_CONNECT_API_ISSUER_ID`
6. Click **Download API Key** to get the `.p8` file (⚠️ you can only download this once!)
7. Encode the `.p8` file:

```bash
base64 -i AuthKey_ABC123XYZ.p8 | tr -d '\n'
```

### Local Development vs CI

| Environment             | Signing Method                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| **Local (Xcode)**       | Automatic signing - Xcode manages everything with your Apple ID     |
| **CI (GitHub Actions)** | Manual signing - uses exported certificate and provisioning profile |

For local development, just open the project in Xcode and ensure **"Automatically manage signing"** is enabled in the Signing & Capabilities tab.

## App Configuration

| Property           | Value                  |
| ------------------ | ---------------------- |
| App ID             | `app.trizum.capacitor` |
| iOS Deployment     | iOS 16.4+              |
| Android Min SDK    | 23 (Android 6.0)       |
| Android Target SDK | 35 (Android 15)        |

## Capacitor Plugins

- `@capacitor/app` - App state and URL handling
- `@capacitor/splash-screen` - Native splash screen
- `@capawesome/capacitor-app-update` - In-app updates
- `capacitor-plugin-safe-area` - Safe area insets

## Generating Assets

To regenerate app icons and splash screens from source assets:

```bash
vp run assets:generate
```

Source assets are in `packages/mobile/assets/`.
