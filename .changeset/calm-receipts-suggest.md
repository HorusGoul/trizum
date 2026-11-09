---
"@trizum/pwa": minor
"@trizum/analytics": patch
---

Add receipt suggestions for Boosted parties. Receipt photos are analyzed by a protected Cloudflare endpoint that returns the merchant, final total, printed currency, and item lines. Review and accept title or total suggestions in the expense editor while attachments continue syncing.

Expense titles describe the purchased items or activity in your app language, with the merchant name as a fallback. Analysis stays quiet until suggestions are ready; failures keep the receipt and manual editor usable without notifications.
