---
"@trizum/logging": patch
"@trizum/pwa": patch
"@trizum/server": patch
---

Redact Automerge document IDs before logs reach console or monitoring sinks,
including nested error causes and stacks, while preserving diagnostic context.
Remove the document ID from cloud-sync success logs.

Fixes #452.
