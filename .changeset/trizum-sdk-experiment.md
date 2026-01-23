---
"@trizum/sdk": minor
"@trizum/pwa": patch
---

Add initial Trizum SDK package

This introduces the @trizum/sdk package, which abstracts Automerge-related functionality behind a clean SDK interface. The SDK provides:

- TrizumClient for managing the Automerge repository
- React hooks with Suspense support (useSuspenseDocument, useSuspenseHandle, useMultipleSuspenseDocuments)
- Document caching with live subscriptions
- Retry utilities with exponential backoff
- Type-safe model definitions
- RepoContext for backwards compatibility

The PWA has been refactored to use the SDK exports while maintaining backwards compatibility with existing code.

