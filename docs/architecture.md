# Architecture

trizum is built as a **monorepo** with a local-first architecture. The core principle is that all data lives on the client first, with optional synchronization to a server for cross-device access.

## Data flow

1. **Local Changes**. All user actions immediately update the local Automerge document
2. **Persistence**. Documents are stored in IndexedDB for offline access
3. **Sync**. When online, changes are synchronized via WebSocket to the server
4. **Conflict Resolution**. Automerge CRDTs automatically merge changes from multiple devices

[Project overview](../README.md). For implementation, start with the [PWA](../packages/pwa/README.md) or [sync server](../packages/server/README.md).
