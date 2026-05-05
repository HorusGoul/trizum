# @trizum/pwa

## 1.7.1

### Patch Changes

- 09ef7ba: Replace the PWA icon loader with a generated SVG sprite pipeline.
  - generate a minimal sprite from the icons actually referenced in the app
  - add typed sprite IDs for Lucide static icons and custom SVG icon sets
  - remove the old Lucide lazy-loading and preload generation setup

- 92c0ea9: Migrate the PWA's virtualized emoji picker and expense log from `@tanstack/react-virtual` to `react-window`.

  This keeps the existing user flows intact while simplifying scroll restoration and removing the React 19 workaround the old virtualization layer required.

## 1.7.0

### Minor Changes

- 750a8f6: Refresh the home screen party list with a new card-based layout and party management controls.
  - order parties by pinned status and most recent use
  - let users pin and archive parties from the home screen
  - add a dedicated archived parties screen with restore actions

- a42ebec: Add reusable modal sheet action primitives and use them for home party actions.
  - add a shared modal sheet primitive built on `react-modal-sheet`
  - open party actions from a long press on mobile and a hover-revealed menu on desktop
  - preserve the existing card press feedback while improving sheet action layout and safe-area handling

### Patch Changes

- 9116b2b: Standardize several loading states on the shared Trizum spinner component.
  - replace the party pending screen's inline spinner SVG with `TrizumSpinner`
  - use `TrizumSpinner` for avatar uploads and the emoji picker loading state

- 652cf7a: Switch the PWA's animation runtime from `framer-motion` to the `motion` package.
  - update the animated tabs, QR scanner, and media gallery imports to use Motion's React entrypoint
  - keep the existing animation behavior while aligning with the current package name

## 1.6.1

### Patch Changes

- 344b355: Support Android HEIC and HEIF photo uploads by converting them before preview and storage.
- d00e326: Fix the create-party activation redirect after identity selection and add harness coverage for the `/new` journey.
- 85bbffe: Fix party expense log pagination so seeded and newly added expenses load reliably in newest-first order.
- 0e95819: Fix the photo gallery overlay so it stays fixed to the viewport after scrolling.
- 925914c: Add a dedicated party stats screen with flexible date filters and spender rankings.

## 1.6.0

### Minor Changes

- 9d73432: Add calculator toolbar for currency fields
  - Full iOS-style calculator UI with number pad
  - Cursor positioning via tap and drag gestures
  - Keyboard support (numbers, operators, backspace, enter, escape, arrow keys)
  - Transform-based scrolling for long expressions
  - Popover mode on large screens, bottom toolbar on mobile
  - Currency-aware financial rounding (e.g., 2 decimals for USD)
  - Parentheses support for complex expressions

- 7e08bca: Move color theme selector from party settings to global user settings. The accent color is now a user-wide preference instead of per-party.

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
