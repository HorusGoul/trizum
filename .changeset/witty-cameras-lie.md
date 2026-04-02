---
"@trizum/pwa": patch
---

Switch the PWA's animation runtime from `framer-motion` to the `motion` package.

- update the animated tabs, QR scanner, and media gallery imports to use Motion's React entrypoint
- keep the existing animation behavior while aligning with the current package name
