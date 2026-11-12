---
"@trizum/pwa": minor
"@trizum/analytics": patch
"@trizum/ui": minor
---

Add receipt suggestions for Boosted parties. Receipt photos are analyzed by a protected Cloudflare endpoint that returns the merchant, final total, printed or inferred currency, and item lines. Review and accept title, total, or currency suggestions in the expense editor while attachments continue syncing.

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
