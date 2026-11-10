---
"@trizum/pwa": patch
---

Recover local document storage after the browser closes its IndexedDB connection. Retry the interrupted operation once on a new connection while continuing to report persistent storage failures.
