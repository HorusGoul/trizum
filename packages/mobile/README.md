# trizum mobile

Capacitor-based mobile application for trizum.

## Overview

This package wraps the PWA (`@trizum/pwa`) as a native mobile application using [Capacitor](https://capacitorjs.com/). It provides native functionality and distribution via the App Store and Google Play.

## Prerequisites

- **Node.js** ^24 (use `nvm use` in the repo root)
- **pnpm** 10.14.0
- **For iOS:**
  - macOS with Xcode 15+
  - CocoaPods (`gem install cocoapods`)
  - Apple Developer account (for device testing/distribution)
- **For Android:**
  - Android Studio with SDK 35
  - Java 17+
- **Fastlane** (for automated builds): `gem install fastlane`

## Getting Started

### Initial Setup

```bash
# From repo root
pnpm install

# Build the PWA first
pnpm turbo run build --filter=@trizum/pwa

# Sync Capacitor (copies web assets to native projects)
cd packages/mobile
pnpm build
```

### Development

For live development with hot reload:

1. Create a `.env` file in `packages/mobile`:

```bash
DEV_URL=http://YOUR_LOCAL_IP:5173
```

2. Start the PWA dev server:

```bash
cd packages/pwa
pnpm dev --host
```

3. Run on device/simulator:

```bash
cd packages/mobile
pnpm dev:android  # For Android
pnpm dev:ios      # For iOS
```

### Opening in IDEs

```bash
pnpm open:android  # Opens in Android Studio
pnpm open:ios      # Opens in Xcode
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
│       └── Gemfile       # Ruby dependencies for fastlane
├── dist/                 # Copied PWA assets (gitignored)
├── assets/               # Source assets (icons, splash screens)
├── capacitor.config.ts   # Capacitor configuration
└── package.json
```

## Scripts

| Script           | Description                                |
| ---------------- | ------------------------------------------ |
| `build`          | Copy PWA assets and sync Capacitor         |
| `open:android`   | Open Android project in Android Studio     |
| `open:ios`       | Open iOS project in Xcode                  |
| `run:android`    | Build and run on Android device/emulator   |
| `run:ios`        | Build and run on iOS device/simulator      |
| `dev:android`    | Run in dev mode with live reload (Android) |
| `dev:ios`        | Run in dev mode with live reload (iOS)     |
| `assets:generate`| Generate app icons and splash screens      |

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

| Lane                | Description                          |
| ------------------- | ------------------------------------ |
| `build_debug`       | Build debug APK                      |
| `build_release`     | Build release APK (signed)           |
| `build_aab`         | Build release AAB for Play Store     |
| `deploy_internal`   | Upload to Play Store internal track  |
| `deploy_beta`       | Upload to Play Store beta track      |
| `deploy_production` | Upload to Play Store production      |

```bash
cd packages/mobile/android
bundle exec fastlane build_debug
bundle exec fastlane build_release
```

#### iOS (`packages/mobile/ios/App`)

| Lane               | Description                       |
| ------------------ | --------------------------------- |
| `build_debug`      | Build debug app for simulator     |
| `build_release`    | Build release IPA for App Store   |
| `build_adhoc`      | Build ad-hoc IPA for distribution |
| `deploy_testflight`| Build and upload to TestFlight    |
| `deploy_appstore`  | Build and upload to App Store     |

```bash
cd packages/mobile/ios/App
bundle exec fastlane build_debug
bundle exec fastlane build_release
```

### Environment Variables

#### Android

| Variable                      | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `ANDROID_KEYSTORE_FILE`       | Path to the release keystore file              |
| `ANDROID_KEYSTORE_PASSWORD`   | Keystore password                              |
| `ANDROID_KEY_ALIAS`           | Key alias in the keystore                      |
| `ANDROID_KEY_PASSWORD`        | Key password                                   |
| `GOOGLE_PLAY_JSON_KEY_FILE`   | Path to Google Play service account JSON       |

#### iOS

| Variable                                 | Description                                      |
| ---------------------------------------- | ------------------------------------------------ |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`    | Base64-encoded distribution certificate (.p12)   |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`  | Password for the .p12 certificate                |
| `IOS_PROVISIONING_PROFILE_BASE64`        | Base64-encoded provisioning profile              |
| `APP_STORE_CONNECT_API_KEY_ID`           | App Store Connect API Key ID                     |
| `APP_STORE_CONNECT_API_ISSUER_ID`        | App Store Connect API Issuer ID                  |
| `APP_STORE_CONNECT_API_KEY_CONTENT`      | Base64-encoded App Store Connect API Key (.p8)   |

## GitHub Actions

A `workflow_dispatch` workflow is available for building mobile apps in CI. Navigate to **Actions > Mobile Build** in GitHub and select:

- **Platform**: `android`, `ios`, or `both`
- **Build type**: `debug` or `release`
- **Android artifact**: `apk` or `aab` (for release builds)
- **iOS export method**: `app-store` or `ad-hoc` (for release builds)

### Required Secrets

Configure these secrets in your GitHub repository settings (**Settings → Secrets and variables → Actions**):

#### Android Secrets

| Secret                       | Description                                |
| ---------------------------- | ------------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`    | Base64-encoded release keystore            |
| `ANDROID_KEYSTORE_PASSWORD`  | Keystore password                          |
| `ANDROID_KEY_ALIAS`          | Key alias                                  |
| `ANDROID_KEY_PASSWORD`       | Key password                               |

**How to get Android secrets:**

```bash
# Encode your keystore file
base64 -i your-release.keystore | tr -d '\n'
```

#### iOS Secrets

| Secret                                    | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`     | Base64-encoded distribution certificate (.p12)   |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`   | Password used when exporting the .p12            |
| `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64`| Base64-encoded App Store provisioning profile    |
| `IOS_ADHOC_PROVISIONING_PROFILE_BASE64`   | Base64-encoded Ad Hoc provisioning profile (optional) |
| `APP_STORE_CONNECT_API_KEY_ID`            | App Store Connect API Key ID                     |
| `APP_STORE_CONNECT_API_ISSUER_ID`         | App Store Connect API Issuer ID                  |
| `APP_STORE_CONNECT_API_KEY_CONTENT`       | Base64-encoded API Key content (.p8 file)        |

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

#### 2. Download Provisioning Profile

Provisioning profiles link your app ID, certificate, and (for Ad Hoc) device UDIDs.

1. Go to [Apple Developer Portal → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Find (or create) your **App Store** provisioning profile for `app.trizum.capacitor`
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

| Environment | Signing Method |
| ----------- | -------------- |
| **Local (Xcode)** | Automatic signing - Xcode manages everything with your Apple ID |
| **CI (GitHub Actions)** | Manual signing - uses exported certificate and provisioning profile |

For local development, just open the project in Xcode and ensure **"Automatically manage signing"** is enabled in the Signing & Capabilities tab.

## App Configuration

| Property          | Value                    |
| ----------------- | ------------------------ |
| App ID            | `app.trizum.capacitor`   |
| iOS Deployment    | iOS 14.0+                |
| Android Min SDK   | 23 (Android 6.0)         |
| Android Target SDK| 35 (Android 15)          |

## Capacitor Plugins

- `@capacitor/app` - App state and URL handling
- `@capacitor/splash-screen` - Native splash screen
- `@capawesome/capacitor-app-update` - In-app updates
- `capacitor-plugin-safe-area` - Safe area insets

## Generating Assets

To regenerate app icons and splash screens from source assets:

```bash
pnpm assets:generate
```

Source assets are in `packages/mobile/assets/`.
