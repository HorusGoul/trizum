---
"@trizum/pwa": patch
---

Wait for the sync peer before loading server-side party documents so slower WebSocket handshakes do not prematurely fail Party Boost membership checks or share previews.

Initialize the sync connection only when needed and reuse it for document reads throughout each Worker request.
