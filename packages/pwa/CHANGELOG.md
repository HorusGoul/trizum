# @trizum/pwa

## 1.11.0

### Minor Changes

- [#406](https://github.com/HorusGoul/trizum/pull/406) [`a062ef2`](https://github.com/HorusGoul/trizum/commit/a062ef2f454e58a2507dddad09f7344c503a8dd9) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Improve expense validation with a persistent form status bar and a detailed dialog for form-wide issues such as mismatched split totals.

- [#397](https://github.com/HorusGoul/trizum/pull/397) [`4239bdc`](https://github.com/HorusGoul/trizum/commit/4239bdc4318f4e6e0b66b3104789e2ff845404cd) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Redesign the first-run home screen and make trizum cloud sign-in directly accessible from home.

- [#404](https://github.com/HorusGoul/trizum/pull/404) [`a3a0217`](https://github.com/HorusGoul/trizum/commit/a3a021704f646fc0dd6875225c89d79acdfb1f0c) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Split Party Settings into dedicated party details and participant sections that save independently.

- [#371](https://github.com/HorusGoul/trizum/pull/371) [`d4942fc`](https://github.com/HorusGoul/trizum/commit/d4942fc71d8d9b88757e7ab048a8dfe7eb85f655) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Improve the expense editor calculator across desktop and mobile.

  - Make selected amount editing, operators, localized physical-keyboard input, and close/reopen behavior reliable.
  - Add a draggable mobile calculator sheet that keeps the active field visible and preserves scroll through rapid navigation.
  - Keep receipt attachments accessible from the mobile calculator with an indexed, keyboard-friendly thumbnail preview.

- [#372](https://github.com/HorusGoul/trizum/pull/372) [`440d9e8`](https://github.com/HorusGoul/trizum/commit/440d9e8dfaa7f7f9e154eced2fcdd6ab74888e2e) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Generate party share previews for social networks and chat apps.

  Party links now serve crawler-only Open Graph and Twitter metadata, plus a
  generated image that includes the party title, icon, description, join CTA, and
  trizum branding while preserving normal SPA navigation for browser visits.

### Patch Changes

- [#365](https://github.com/HorusGoul/trizum/pull/365) [`b0a3170`](https://github.com/HorusGoul/trizum/commit/b0a31705cd8e16bbdb9ee013856074cc872e3940) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Keep Android back navigation inside a party from exiting the app when the party was opened directly on launch.

- [#244](https://github.com/HorusGoul/trizum/pull/244) [`ab7ad9c`](https://github.com/HorusGoul/trizum/commit/ab7ad9c1626ce5da06cffd59f0ef5a2d02c17bca) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Move party balance recalculation to the app worker so large parties do not block the UI thread, and let users refresh balances manually with a pull-down gesture.

- [#229](https://github.com/HorusGoul/trizum/pull/229) [`f4ca302`](https://github.com/HorusGoul/trizum/commit/f4ca302cdb50ca87323d9f61bfbcb7a6ff656d72) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add Async React action props to shared UI components so buttons, menu items,
  tabs, switches, and checkboxes can own transitions, optimistic state, and local
  pending feedback.

- [#370](https://github.com/HorusGoul/trizum/pull/370) [`f6d18a9`](https://github.com/HorusGoul/trizum/commit/f6d18a90f8fdd61d1c483a3308684f10aa247821) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix realtime editor avatars jumping to the top of the screen when collaborators focus amount fields.

- [#356](https://github.com/HorusGoul/trizum/pull/356) [`56c64ba`](https://github.com/HorusGoul/trizum/commit/56c64baf1903ccdc786a4edd7b4bbbe3556cf21a) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Migrate the PWA styling pipeline to Tailwind CSS v4, use the workspace dynamic-theme CLI for generated accent theme variables, and vendor the safe-area Tailwind plugin for v4 compatibility.

- [#366](https://github.com/HorusGoul/trizum/pull/366) [`4c0c4fe`](https://github.com/HorusGoul/trizum/commit/4c0c4fea288372e2744cb57b1d1609d2fd6e991b) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix expense edit navigation so going back once after saving returns to the party expense log.

- [#373](https://github.com/HorusGoul/trizum/pull/373) [`20f7709`](https://github.com/HorusGoul/trizum/commit/20f77091cee2e41438996dbca976b852259f5987) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Restyle app toasts with the PWA design system and keep toast placement clear of mobile safe areas.

- [#403](https://github.com/HorusGoul/trizum/pull/403) [`c646b64`](https://github.com/HorusGoul/trizum/commit/c646b641e114b4414ab9d0fb9eeb1b56292bc48f) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Show newly added expense attachments before saving, open the gallery on the selected attachment, keep gallery controls available while media loads, restore the backdrop after gesture dismissal, and prevent expired edit drafts from restoring discarded attachments.

- [#214](https://github.com/HorusGoul/trizum/pull/214) [`cc62b54`](https://github.com/HorusGoul/trizum/commit/cc62b54324c73b20c1497398c8f63d72b1019993) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent crawlers from indexing party routes by sending a noindex robots header for `/party/*` responses.

- [#328](https://github.com/HorusGoul/trizum/pull/328) [`342af5b`](https://github.com/HorusGoul/trizum/commit/342af5bf7e468d94eb80c42ea95b2210c5bbeafe) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Migrate app money calculations and formatting from Dinero.js v1 to Dinero.js v2.

  - Updates the PWA to use Dinero v2 standalone functions and snapshots.
  - Keeps Trizum's existing expense-share rounding behavior covered by tests.
  - Adds formatting and currency-boundary tests for the migration.

- [#405](https://github.com/HorusGoul/trizum/pull/405) [`ef40e39`](https://github.com/HorusGoul/trizum/commit/ef40e39d17658589d7c8807f2da8992b6b4531ff) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent expense amount fields from displaying or saving negative participant allocations.

- [#364](https://github.com/HorusGoul/trizum/pull/364) [`f353391`](https://github.com/HorusGoul/trizum/commit/f35339188e3a079ba49962798d8ad0555356016b) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Preserve form draft values when validation blocks submission.

- [#362](https://github.com/HorusGoul/trizum/pull/362) [`b7b4ee9`](https://github.com/HorusGoul/trizum/commit/b7b4ee95a6c57fba7419a55e7aa81fe658cc6023) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Pin `barcode-detector` to 3.0.8 to keep QR scanning on the ZXing WASM version used by the last stable release.

- [#402](https://github.com/HorusGoul/trizum/pull/402) [`4a662be`](https://github.com/HorusGoul/trizum/commit/4a662bec48feaf5bdbb8db844eb906043097189d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Restore native safe-area spacing by enabling edge-to-edge viewport insets in mobile WebViews.

- [#336](https://github.com/HorusGoul/trizum/pull/336) [`d3d0207`](https://github.com/HorusGoul/trizum/commit/d3d02074bdbe12111e931733216e4b543dc95b8c) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix Party Settings reverting fields after saving while keeping settings forms' post-save navigation.

- [#216](https://github.com/HorusGoul/trizum/pull/216) [`7ca387f`](https://github.com/HorusGoul/trizum/commit/7ca387fddfde6470b32c2d046f1871c9367a8d51) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Skip immediate party balance recalculation when adding, updating, or removing expenses.

- [#367](https://github.com/HorusGoul/trizum/pull/367) [`a5e6761`](https://github.com/HorusGoul/trizum/commit/a5e6761fef950891a9219afad41ebdd8a9b6e5a1) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add a React 19 stable-compatible Suspense cache package and migrate the PWA Automerge document cache off the external `suspense` dependency.

- [#332](https://github.com/HorusGoul/trizum/pull/332) [`be80f7d`](https://github.com/HorusGoul/trizum/commit/be80f7d9f3430ececaaf3e998eac25a01f235658) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Make Tricount imports deterministic by normalizing remote response order before creating expenses.

  - Sorts imported memberships, registry entries, and allocations before building party data.
  - Keeps repeated imports from assigning rounding cents to different participants.
  - Recalculates balances before opening the migrated party.

- [#345](https://github.com/HorusGoul/trizum/pull/345) [`e43b949`](https://github.com/HorusGoul/trizum/commit/e43b94965ed2e6dbb947474d066637155b2ea98d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Align the PWA browser build target with Vite's Baseline browser set and require iOS 16.4 or newer for native iOS installs.

- [#213](https://github.com/HorusGoul/trizum/pull/213) [`2a686d4`](https://github.com/HorusGoul/trizum/commit/2a686d4b994a38bd9421d26376ce67a5e46bfcf9) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix Cloudflare Worker deploy preview builds by preserving the Worker handler export and using the browser-safe `debug` entry during upload validation.

- Updated dependencies [[`56c64ba`](https://github.com/HorusGoul/trizum/commit/56c64baf1903ccdc786a4edd7b4bbbe3556cf21a), [`a5e6761`](https://github.com/HorusGoul/trizum/commit/a5e6761fef950891a9219afad41ebdd8a9b6e5a1)]:
  - @trizum/tw-dynamic-themes@0.0.4
  - @trizum/react-suspense-cache@0.1.0

## 1.10.1

### Patch Changes

- [`c137bce`](https://github.com/HorusGoul/trizum/commit/c137bceecfa75593a7a60c4821fffd84f17f5e9a) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Release patch updates for the PWA and mobile packages.

## 1.10.0

### Minor Changes

- [#190](https://github.com/HorusGoul/trizum/pull/190) [`503a037`](https://github.com/HorusGoul/trizum/commit/503a0371f9a22a5124fd23442fe171e5932ad66b) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add Cloudflare-backed account authentication and cloud profile settings sync.

### Patch Changes

- [#200](https://github.com/HorusGoul/trizum/pull/200) [`e3f4451`](https://github.com/HorusGoul/trizum/commit/e3f4451466920b4a49476b01b3073b4bc1df6584) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Allow the Capacitor Android `https://localhost` origin to sign in to trizum cloud.

- [#197](https://github.com/HorusGoul/trizum/pull/197) [`a65cdd3`](https://github.com/HorusGoul/trizum/commit/a65cdd322ed7d98492ffaf97cdd17976a46dc2e8) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Show the cloud data switch prompt as a centered, non-dismissable modal with a blocking backdrop.

- [#196](https://github.com/HorusGoul/trizum/pull/196) [`94d64e8`](https://github.com/HorusGoul/trizum/commit/94d64e8c3128a21af5e2a2649a6672aadafa63e3) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Show trizum cloud account-linking errors in a dialog, including OAuth email mismatch errors.

- [#203](https://github.com/HorusGoul/trizum/pull/203) [`368110c`](https://github.com/HorusGoul/trizum/commit/368110c46d733cf419261d2ac0332589f86aa77f) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix native iOS auth flows so cold-start email auth links route correctly, native Apple/Google sign-in persists the returned session token for cloud API calls, and sign-in does not stay stuck in the loading state after success.

- [#198](https://github.com/HorusGoul/trizum/pull/198) [`54e5652`](https://github.com/HorusGoul/trizum/commit/54e565296b2959659e0968ee1b016fbb8f74ced8) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix mobile trizum cloud sign-in CORS preflights and add native safe-area spacing to the full-screen sign-in dialog.

- [#206](https://github.com/HorusGoul/trizum/pull/206) [`a303a7a`](https://github.com/HorusGoul/trizum/commit/a303a7a6d5d51b467577e27066fe22a2a2c5074c) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Update privacy and store metadata disclosures for trizum cloud accounts.

  - Covers account sign-in, linked Google and Apple providers, Cloudflare-backed storage, authentication emails, sessions, and cloud account deletion.
  - Keeps store metadata clear that accounts are optional for getting started and only needed for trizum cloud sync across devices.

- [#204](https://github.com/HorusGoul/trizum/pull/204) [`cbb3260`](https://github.com/HorusGoul/trizum/commit/cbb32606eb4c26e527f62d902094d0fdb57c9575) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Stop requesting name/profile data during Apple and Google sign-in.

- [#205](https://github.com/HorusGoul/trizum/pull/205) [`da7aec0`](https://github.com/HorusGoul/trizum/commit/da7aec0cc03a737077602e4cdb5f0ea1f0af752b) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent duplicate app history entries so back and close buttons return to the expected screen.

## 1.9.2

### Patch Changes

- [#186](https://github.com/HorusGoul/trizum/pull/186) [`7426462`](https://github.com/HorusGoul/trizum/commit/7426462ad902cd6fe7edb2c66fd027ddb2aade0d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Update Automerge runtime dependencies to the latest published patch releases.

## 1.9.1

## 1.9.0

### Minor Changes

- [#177](https://github.com/HorusGoul/trizum/pull/177) [`9f8611e`](https://github.com/HorusGoul/trizum/commit/9f8611e8994886becbc9945e2c67f82f54a17430) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Release the next minor version of the PWA.

### Patch Changes

- [#176](https://github.com/HorusGoul/trizum/pull/176) [`7c6e272`](https://github.com/HorusGoul/trizum/commit/7c6e272d04128c4d8d422c9d65166d9dc338a46e) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix Android expense and avatar camera buttons opening the gallery instead of camera capture.

- [#163](https://github.com/HorusGoul/trizum/pull/163) [`162e385`](https://github.com/HorusGoul/trizum/commit/162e385c74b8b5d06df33f4bc90542f36c570ec2) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix Tricount imports from localized share URLs.

- [#156](https://github.com/HorusGoul/trizum/pull/156) [`a2881ed`](https://github.com/HorusGoul/trizum/commit/a2881edf589180216b031fd4c7db3f20fae722d6) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Improve accessible labels for PWA media inputs, QR scanning, and icon-only actions.

- [#174](https://github.com/HorusGoul/trizum/pull/174) [`78c5a03`](https://github.com/HorusGoul/trizum/commit/78c5a034cce38d90c004b422fc36091ac7baaeb4) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent Android startup from invoking Google Play in-app update checks on unsupported installs or devices without Google Play support.

- [#158](https://github.com/HorusGoul/trizum/pull/158) [`f27ff00`](https://github.com/HorusGoul/trizum/commit/f27ff00cdf06d88d5bd1f4a702f8784c461f62ba) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent duplicate Expense Editor saves while an existing save is still in progress.

- [#164](https://github.com/HorusGoul/trizum/pull/164) [`9e6893a`](https://github.com/HorusGoul/trizum/commit/9e6893a77e4bb31be3a9695f58aef50cf92edd61) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Preserve Tricount ratio part counts during import so expenses split by parts reopen with the original participant counts in the editor.

## 1.8.0

### Minor Changes

- 0ce9a2a: Add a debt transfer flow that lets users move their own debt from one party to another from the balances screen, including the streamlined selection and review experience.

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
