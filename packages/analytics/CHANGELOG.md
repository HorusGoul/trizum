# @trizum/analytics

## 1.2.0

### Minor Changes

- [#605](https://github.com/HorusGoul/trizum/pull/605) [`83b33f6`](https://github.com/HorusGoul/trizum/commit/83b33f669cf9e9ddef4477bae4e306721f81b890) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add multiple ways to get paid: Bizum, bank transfer, PayPal, Revolut, Venmo, Cash App, and custom instructions. Share receiving details with your groups and open supported payment profiles from the payment screen. Existing Bizum contacts are preserved.

  Track requests to open payment links without collecting payment details or treating them as completed payments.

  Show payment service brand icons in the method picker, receiving details, and payment cards, using the shared offline SVG sprite, with consistently centered artwork.

  Keep the familiar Pay layout and present payment methods in compact cards with titles above their values, aligned service icons, descriptions, and one shared interaction tip. Give info alerts an accent-colored icon while keeping their text neutral. Display and copy profile handles while opening their full payment links. Keep direct links and hold-to-copy without opening the service. Remove copy icons while supporting standard keyboard copying, and keep Bizum phone numbers available to copy with a tap. Edit receiving details through tappable rows with an Edit action, muted example placeholders, and persistent desktop hints, add methods from a clearly styled button that opens shared mobile sheet actions or a desktop menu, and preview, copy, or remove methods from their action menus.

  Keep the empty receiving-method section compact and explain how group members use shared payment details to settle debts.

  Let blank receiving methods reopen for editing with one tap and remove them when saving. Show service-specific validation, including Bizum phone guidance without asking for a country code, show errors after leaving a field, and align payment-row icons with the add button.

  Support Enter and Space to copy non-link methods once, and preserve native copying of selected text within payment details.

### Patch Changes

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

## 1.1.1

### Patch Changes

- [#587](https://github.com/HorusGoul/trizum/pull/587) [`16ba80f`](https://github.com/HorusGoul/trizum/commit/16ba80f38f2e85615180c09071a2048836406a8d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Exclude automated browsers from usage analytics and prevent store screenshot captures from sending production analytics requests.

## 1.1.0

### Minor Changes

- [#476](https://github.com/HorusGoul/trizum/pull/476) [`a637690`](https://github.com/HorusGoul/trizum/commit/a63769028e562dcf4f0a190ff5e9521b8190b470) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add privacy-aware InsightFlare pageviews and feature usage events with an immediate Settings opt-out. Honor browser privacy signals, redact all dynamic route identifiers, and exclude personal and financial data from analytics payloads.

  Cover group management, expenses and templates, imports, sharing, editing tools, cloud accounts, and Premium flows with documented custom events. Distinguish successful operations from external-flow requests, cancellations, and failures.

  Buffer sanitized startup events briefly until preferences load. Sync a random telemetryId with the party list and reuse it for analytics, Sentry, and PWA logs, honoring opt-out and browser privacy signals. Disclose cross-device correlation in the privacy policy.

  Proxy analytics through trizum's API with a Cloudflare service binding, preserving visitor metadata and supporting native CORS with readable responses.

  Keep the Settings analytics description concise and preserve bottom spacing above device safe areas.
