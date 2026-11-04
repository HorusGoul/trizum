---
"@trizum/pwa": patch
---

Stop QR scanner camera streams and pending feedback when the scanner closes, including camera requests that finish after closing. Validate pasted party links with the shared QR parser, reject failed photo downloads, and avoid allocating image URLs when canvas is unavailable.
