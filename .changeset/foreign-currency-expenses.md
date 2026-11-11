---
"@trizum/pwa": minor
---

Support foreign-currency expenses with an amount and currency row, editable exchange rates, preserved original amounts, and read-only converted totals in the party currency. Enter participant shares in the selected expense currency and preserve their original amounts alongside party-currency calculations. Include offline reference rates with cached updates through a public Worker endpoint, and preserve currency conversion details when importing from Tricount.

Show the original currency first in expense details and lists, with converted totals alongside it. Allow expense templates to configure a currency and choose a fixed exchange rate or the latest available reference when creating an expense. Keep expense fields aligned when labels wrap and maintain consistent spacing between variable-height virtualized expense cards.

Preserve authoritative allocations when renaming older foreign expenses, and keep zero shares out of conversion rounding remainders.
