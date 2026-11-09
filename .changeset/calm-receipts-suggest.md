---
"@trizum/pwa": minor
"@trizum/analytics": patch
---

Add receipt suggestions for Boosted parties. Receipt photos are analyzed by a protected Cloudflare endpoint that returns the merchant, final total, printed currency, and item lines. Review and accept title or total suggestions in the expense editor while attachments continue syncing.

Expense titles describe the purchased items or activity, preferring the receipt's language and offering an app-language alternative when useful, with the merchant name as a fallback. Analysis stays quiet until suggestions are ready; failures keep the receipt and manual editor usable without notifications.

Choose a receipt title from horizontally scrollable options before accepting it. A gentle glow around each receipt photo stays active while analysis runs, with a static ring for reduced motion.

Compact suggestion rows align leading icons with the sheet heading and keep checkboxes on the right.
