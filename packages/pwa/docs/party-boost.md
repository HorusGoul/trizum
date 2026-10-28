# Shared Party Boost state

[Back to package overview](../README.md). Read when changing boost state, transfers, or migrations.

## Shared Party Boost State

A party may contain `boost?: Record<BoostId, { boostId, participantId, boostedAt,
checkedAt }>`. Each entry represents one boost, keyed by its opaque database ID.
Both timestamps are ISO strings: `boostedAt` is the current party assignment time,
and `checkedAt` is the last server verification. The participant ID belongs to
this party; auth user IDs are never published in the shared document.

Missing state means the party has not been checked yet. An empty map means no
active boosts were found. Signed-out members can use this shared cache for local
features, including offline, and its size can support future boost-based limits.
It is client-editable and may be stale: server operations still require sign-in,
membership and authoritative entitlement checks. Successful checks publish the
current state; transfer and revocation remove the previous party's entry.

Migration `0005_party_boost_id.sql` gives existing assignments stable random IDs.
The current one-boost-per-owner and one-active-boost-per-party limits remain in
the database until the product supports stacking boosts. Transfers retain the
boost ID and reset the assignment time; reactivation retains both ID and original
assignment time, preserving the existing cooldown behavior.

Migration `0006_party_boost_pending_cleanup.sql` records a transfer's previous
party in the same database update as the assignment move. A successful retry or
owner status check reconciles that destination before clearing the marker. New
transfers must finish pending cleanup first, so a failed sync write cannot lose
the old destination. Personal status remains unknown until loaded; an empty
shared map cannot authorize the UI to skip transfer confirmation.
