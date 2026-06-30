---
"@trizum/mobile": patch
"@trizum/pwa": patch
---

Migrate app money calculations and formatting from Dinero.js v1 to Dinero.js v2.

- Updates the PWA to use Dinero v2 standalone functions and snapshots.
- Keeps Trizum's existing expense-share rounding behavior covered by tests.
- Adds formatting and currency-boundary tests for the migration.
