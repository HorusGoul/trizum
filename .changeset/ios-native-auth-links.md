---
"@trizum/pwa": patch
---

Fix native iOS auth flows so cold-start email auth links route correctly, native Apple/Google sign-in persists the returned session token for cloud API calls, and sign-in does not stay stuck in the loading state after success.
