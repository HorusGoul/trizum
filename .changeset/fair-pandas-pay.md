---
"@trizum/pwa": minor
"@trizum/analytics": minor
"@trizum/ui": patch
---

Add multiple ways to get paid: Bizum, bank transfer, PayPal, Revolut, Venmo, Cash App, and custom instructions. Share receiving details with your groups and open supported payment profiles from the payment screen. Existing Bizum contacts are preserved.

Track requests to open payment links without collecting payment details or treating them as completed payments.

Show payment service brand icons in the method picker, receiving details, and payment cards, using the shared offline SVG sprite, with consistently centered artwork.

Keep the familiar Pay layout and present payment methods in compact cards with titles above their values, aligned service icons, descriptions, and one shared interaction tip. Display and copy profile handles while opening their full payment links. Keep direct links and hold-to-copy without opening the service. Remove copy icons while supporting standard keyboard copying, and keep Bizum phone numbers available to copy with a tap. Edit receiving details through tappable rows with an Edit action, muted example placeholders, and persistent desktop hints, add methods from a clearly styled button that opens shared mobile sheet actions or a desktop menu, and preview, copy, or remove methods from their action menus.

Keep the empty receiving-method section compact and explain how group members use shared payment details to settle debts.

Let blank receiving methods reopen for editing with one tap and remove them when saving. Show service-specific validation, including Bizum phone guidance without asking for a country code, show errors after leaving a field, and align payment-row icons with the add button.
