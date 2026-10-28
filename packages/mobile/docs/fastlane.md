# Fastlane builds and deployment

[Back to package overview](../README.md). Read when running native build or upload lanes. See [store metadata](./store-metadata.md) for listings and privacy declarations, and [signing](./signing.md) for CI credentials.

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

Google Play app-content declarations are managed separately from listing and
binary uploads. See the [Android disclosure guide](../android/fastlane/play-disclosures.md)
for the Data safety CSV lane, the 1.13.0 audit, submission status, and deletion
requirements.

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
