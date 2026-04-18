---
"@trizum/mobile": patch
"@trizum/pwa": patch
---

Migrate the PWA's virtualized emoji picker and expense log from `@tanstack/react-virtual` to `react-window`.

This keeps the existing user flows intact while simplifying scroll restoration and removing the React 19 workaround the old virtualization layer required.
