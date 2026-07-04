---
"@trizum/mobile": patch
"@trizum/pwa": patch
---

Make Tricount imports deterministic by normalizing remote response order before creating expenses.

- Sorts imported memberships, registry entries, and allocations before building party data.
- Keeps repeated imports from assigning rounding cents to different participants.
- Flushes imported party documents before recalculating balances at the end of migration.
