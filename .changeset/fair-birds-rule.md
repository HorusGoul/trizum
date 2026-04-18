---
"@trizum/pwa": patch
---

Replace the PWA icon loader with a generated SVG sprite pipeline.

- generate a minimal sprite from the icons actually referenced in the app
- add typed sprite IDs for Lucide static icons and custom SVG icon sets
- remove the old Lucide lazy-loading and preload generation setup
