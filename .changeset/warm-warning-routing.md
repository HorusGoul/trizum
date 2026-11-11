---
"@trizum/logging": patch
"@trizum/pwa": patch
"@trizum/server": patch
---

Send warning and higher log records to Sentry in the PWA and sync server. Preserve severity and document-ID redaction; warnings appear in Sentry Logs, while errors and fatal records also create issues.
