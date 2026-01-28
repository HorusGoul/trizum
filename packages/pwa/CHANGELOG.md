# @trizum/pwa

## 1.5.1

### Patch Changes

- 605b6c1: Fix the emoji picker when searching for an emoji.

## 1.5.0

### Minor Changes

- 1b3e4f5: Add emoji symbol to parties

  Parties can now have an emoji symbol for quick visual identification. You can pick an emoji when creating a new party or update it in party settings. The emoji picker includes search functionality and is organized by category.

- 308ac3c: Add QR code scanner to join parties

  You can now scan QR codes to quickly join trizum parties. Navigate to the join page and tap "Scan QR code" to use your camera.

### Patch Changes

- 25b1d73: Upgrade Capacitor to v8
  - @capacitor/core: 7.4.4 → 8.0.1
  - @capacitor/android: 7.4.4 → 8.0.1
  - @capacitor/ios: 7.4.4 → 8.0.1
  - @capacitor/app: 7.1.0 → 8.0.0
  - @capacitor/share: 7.0.3 → 8.0.0
  - @capacitor/splash-screen: 7.0.3 → 8.0.0
  - @capawesome/capacitor-app-update: 7.2.0 → 8.0.1
  - capacitor-plugin-safe-area: 4.0.3 → 5.0.0

  Android:
  - minSdkVersion: 23 → 24
  - compileSdkVersion: 35 → 36
  - targetSdkVersion: 35 → 36
  - Gradle plugin: 8.7.2 → 8.13.0
  - Gradle wrapper: 8.11.1 → 8.14.3
  - Added density to configChanges

  iOS:
  - Minimum platform: 14.0 → 15.0

  CI:
  - Updated iOS workflows to use macos-26 for Xcode 26 SDK

## 1.4.1

### Patch Changes

- f2302c0: Fix sourcemaps and improve bundle size

## 1.4.0

### Minor Changes

- fee737b: Add currency selector to create party form with support for all ISO 4217 currencies
- 007f6bb: Allow usage of back button within Gallery, also add swipe up gesture to close the gallery

## 1.3.0

### Minor Changes

- b387fe2: App now defaults to "system" locale and app's language can be changed in system settings.

### Patch Changes

- 7d26de5: Clicking on download update correctly opens the app store listing on iOS

## 1.2.0

### Minor Changes

- 6e913ab: Add button in balances tab that allows users to sort the balances

### Patch Changes

- 679d1b2: Remove add expense menu in production builds given that there's only one option
- cd8c592: Adjust title sizes and truncate them

## 1.1.0

### Minor Changes

- 06020bd: Add "Open last party on launch" setting that automatically opens the last visited party when opening the app

### Patch Changes

- e9a4eec: Build with sourcemaps enabled
- f477b6b: Sort participant lists alphabetically in expense editor and expense details

## 1.0.6

### Patch Changes

- 6497ec6: Add pending state UI for party sync with loading animation, tips, and troubleshooting
- 1e75b8c: Add exponential backoff retry for document handle fetching

## 1.0.5

### Patch Changes

- 1b5ed07: Increase touch target sizes for +/- buttons and row height in the Expense Editor for better usability on touch devices.
- 666de10: Fix safe area insets in gallery view to ensure buttons remain accessible on devices with notches or rounded corners.

## 1.0.4

### Patch Changes

- f386729: Fix party sharing
- fa9bcd2: Add Google Play SHA256 to assetlinks.json
- a140c8a: Fix migrations in native apps

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

### Major Changes

- bc9e06d: Bumping to 1.0.0
