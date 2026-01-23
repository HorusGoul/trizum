---
"@trizum/sdk": minor
"@trizum/pwa": patch
---

Introduce Trizum SDK that abstracts Automerge implementation details

**SDK Features:**
- TrizumClient and TrizumWorkerClient for document operations
- React hooks: useSuspenseDocument, useDocument, useTrizumClient
- Cache utilities for React Suspense integration
- ImmutableString for efficient binary data storage
- Complete type system with no Automerge exposure in public API
- Web Worker support for offloading heavy operations

**PWA Changes:**
- Migrated to use @trizum/sdk instead of direct Automerge imports
- Removed all @automerge dependencies from PWA code
- Models re-exported from SDK for backwards compatibility
