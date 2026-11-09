---
"@trizum/pwa": minor
"@trizum/analytics": patch
"@trizum/ui": minor
---

Add receipt suggestions for Boosted parties. Receipt photos are analyzed by a protected Cloudflare endpoint that returns the merchant, final total, printed currency, and item lines. Review and accept title or total suggestions in the expense editor while attachments continue syncing.

Expense titles describe the purchased items or activity, preferring the receipt's language and offering an app-language alternative when useful, with the merchant name as a fallback. Analysis stays quiet until suggestions are ready; failures keep the receipt and manual editor usable without notifications.

Choose a receipt title from horizontally scrollable options before accepting it. A gradient border with a circling highlight stays inside each receipt photo while analysis runs, with a static border for reduced motion.

Inset suggestion rows use input-style borders aligned with the sheet content, vertically centered icons, and checkboxes on the right. Reusable sheet choices share press, hover, and focus feedback with sheet actions. Title chips are visually compact while keeping comfortable touch targets.

Receipt titles consider the printed transaction time and local context before suggesting a meal, with neutral item or category titles when the meal is uncertain.
