# @trizum/ui

## 0.2.0

### Minor Changes

- [#608](https://github.com/HorusGoul/trizum/pull/608) [`d46dd8a`](https://github.com/HorusGoul/trizum/commit/d46dd8af9bf13789cf7f839f923efacaf7ac66ba) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add receipt suggestions for Boosted parties. Receipt photos are analyzed by a protected Cloudflare endpoint that returns the merchant, final total, printed or inferred currency, and item lines. Review and accept title, total, or currency suggestions in the expense editor while attachments continue syncing.

  Expense titles describe the purchased items or activity, preferring the receipt's language and offering an app-language alternative when useful, with the merchant name as a fallback. Analysis stays quiet until suggestions are ready; failures keep the receipt and manual editor usable without notifications.

  Choose a receipt title from horizontally scrollable options before accepting it. A gradient border with a circling highlight stays inside each receipt photo while analysis runs, with a static border for reduced motion. The remove button stays above the scanning highlight.

  Inset suggestion rows use input-style borders aligned with the sheet content, vertically centered icons, and checkboxes on the right. Reusable sheet choices share press, hover, and focus feedback with sheet actions. Title chips are visually compact while keeping comfortable touch targets.

  Receipt titles consider the printed transaction time and local context before suggesting a meal, with neutral item or category titles when the meal is uncertain.

  Browser and Android Back dismiss the top shared sheet before navigating, preserving the underlying expense draft. Sheet registration is automatic through the app's UI provider, respects non-dismissible sheets, and leaves no extra Back step after closing.

  Skip the suggestions sheet when neither the title, total, nor currency can be changed, including matching values, protected manual edits, or an inapplicable total. Empty results do not block other usable receipt suggestions or count as user discards.

  Offer an explicit, initially selected expense-currency choice when a different currency is supported by the receipt. Prefer printed codes and markers; otherwise combine address, region, phone, tax, domain and language clues generically, with independent image verification. Keep the currency choice compact with a Currency label and the currency code/name; retain printed or inferred evidence in the API response. Applying a foreign total requires accepting its currency; use the editor's exchange-rate flow and keep the party currency unchanged.

  Verify Gemma's candidates against the original image with Clef before offering suggestions. Check titles, merchant, final total, currency evidence, and items independently; omit uncertain fields and keep failures silent. Both models receive the party currency only as verification context, never as evidence of the receipt currency.

  Prepare receipt analysis images in the Worker using the private Images binding. Accept uploads up to 8 MiB, preserve aspect ratio, and enforce image dimensions and a 4 MiB encoded limit before either model runs. Keep the saved attachment unchanged and processing failures silent.

  Keep ordinary receipt suggestions when Clef selects a strictly winning supported decision, rather than rejecting clear receipts through an uncalibrated 0.95 cutoff. Printed markers remain checked literally, while contextual currency inferences retain their source and supporting clues.

  Handle browser Back at the first app entry as well as SPA entries, preserving the open editor and draft. Consume the temporary guard on ordinary close, unmount, and route navigation; recover an orphaned guard after a document reload; cover cross-document navigation in Chromium and WebKit.

  Let the expense editor skip item transcription it does not use, so suggestions can appear sooner. Full endpoint requests still include item details by default, and every proposed title, total and currency keeps independent image verification. Expose numeric stage timings to distinguish inference, access checks and image preparation without receipt data.

### Patch Changes

- [#605](https://github.com/HorusGoul/trizum/pull/605) [`83b33f6`](https://github.com/HorusGoul/trizum/commit/83b33f669cf9e9ddef4477bae4e306721f81b890) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add multiple ways to get paid: Bizum, bank transfer, PayPal, Revolut, Venmo, Cash App, and custom instructions. Share receiving details with your groups and open supported payment profiles from the payment screen. Existing Bizum contacts are preserved.

  Track requests to open payment links without collecting payment details or treating them as completed payments.

  Show payment service brand icons in the method picker, receiving details, and payment cards, using the shared offline SVG sprite, with consistently centered artwork.

  Keep the familiar Pay layout and present payment methods in compact cards with titles above their values, aligned service icons, descriptions, and one shared interaction tip. Give info alerts an accent-colored icon while keeping their text neutral. Display and copy profile handles while opening their full payment links. Keep direct links and hold-to-copy without opening the service. Remove copy icons while supporting standard keyboard copying, and keep Bizum phone numbers available to copy with a tap. Edit receiving details through tappable rows with an Edit action, muted example placeholders, and persistent desktop hints, add methods from a clearly styled button that opens shared mobile sheet actions or a desktop menu, and preview, copy, or remove methods from their action menus.

  Keep the empty receiving-method section compact and explain how group members use shared payment details to settle debts.

  Let blank receiving methods reopen for editing with one tap and remove them when saving. Show service-specific validation, including Bizum phone guidance without asking for a country code, show errors after leaving a field, and align payment-row icons with the add button.

  Support Enter and Space to copy non-link methods once, and preserve native copying of selected text within payment details.

- [#609](https://github.com/HorusGoul/trizum/pull/609) [`9bd67a2`](https://github.com/HorusGoul/trizum/commit/9bd67a240bdd3f9d5ef5bde4f43f5a47e049fbed) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Keep select menus at their trigger width from the first frame so they no longer shrink after opening. Align selected and truncated values to the start and reserve space for the chevron.

## 0.1.0

### Minor Changes

- [#597](https://github.com/HorusGoul/trizum/pull/597) [`a497628`](https://github.com/HorusGoul/trizum/commit/a497628071993570116cf18d876b0c1ddc2e2949) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add the internal React design system package with copied PWA components, shared
  styles and fonts, Lingui catalogs, consumer-generated icons, and local Storybook.
  Compile package components and Storybook development source with the Vite React
  plugin’s React Compiler integration.
  The PWA continues to use its original components until follow-up migrations.

  Allow icon generation to exclude shared generated directories so catalog type
  files do not cause unused icons to be bundled by consumers.

### Patch Changes

- [#604](https://github.com/HorusGoul/trizum/pull/604) [`e202bf9`](https://github.com/HorusGoul/trizum/commit/e202bf9672a61a245d91af4d2c4a050c3209fc95) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Improve gallery flick dismissal and backdrop tracking, pull-to-refresh resistance and cancellation, calculator cursor dragging, and toast swipe direction. Respect reduced motion when gallery and refresh gestures settle.

  Allow shared and calculator sheets to stretch above their highest snap point with resistance and spring back on release.

  Stretch one continuous sheet surface, including its background, border, and shadow, to the screen edge during upward overdrag and spring-back. Keep the content and snap-point measurements unchanged.

  Align the calculator sheet and bottom fill across mobile widths, and restore the gallery backdrop when reopening during its exit animation.

  Start cold sheet openings from their measured height, synchronize backdrop visibility and progress, and use a gentler shared iOS-style opening curve.

  Keep repeated sheet openings animated, reverse interrupted closes without resetting position, and discard superseded transition completions.

  Continue gallery dismissals off-screen with release momentum, retain photos through exit fades, and let refresh pulls continue beyond the threshold with increasing resistance.

- [#611](https://github.com/HorusGoul/trizum/pull/611) [`6f6f7fc`](https://github.com/HorusGoul/trizum/commit/6f6f7fcfe8792b065ea0868e5754a040ab2d0119) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Move option selection checkmarks to the right with more space between the text and indicator, and align section headers with option labels.

- [#610](https://github.com/HorusGoul/trizum/pull/610) [`e523fd6`](https://github.com/HorusGoul/trizum/commit/e523fd6c19207184372ecd90c01c1b273f9e1839) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Restore left, right, and downward toast swipe dismissal and prevent toast text selection from interfering with gestures. Require deliberate travel or a clear flick to dismiss; small nudges and short slow drags snap back.
- Updated dependencies [[`a497628`](https://github.com/HorusGoul/trizum/commit/a497628071993570116cf18d876b0c1ddc2e2949)]:
  - @trizum/icon-sprite@1.1.0
