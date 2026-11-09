---
"@trizum/server": patch
---

Prevent incomplete receipt syncs from crashing the server after a document readiness timeout. Add structured diagnostics for sync connections, large messages, and slow or failed storage operations to investigate interrupted uploads without logging receipt contents.
