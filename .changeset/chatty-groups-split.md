---
"@trizum/pwa": minor
"@trizum/mcp": minor
"@trizum/analytics": minor
---

Add an anonymous ChatGPT app and MCP endpoint for creating shared expense groups,
viewing balances, and recording equally split expenses. Reuse Automerge sync and
existing expense calculations, show an inline group card with a trizum invite
link, and prevent duplicate writes when agents retry requests.

Record anonymous completed MCP action counts through the shared analytics package
without forwarding client identity, request metadata, or group data.

Keep MCP reads off D1, store compact retry receipts, sync existing Automerge
documents on demand, and share analytics bootstrap across actions.

Expire signed write tokens after 15 minutes, clean up compact retry receipts on an
indexed schedule, and bound anonymous writes with Cloudflare's rate limiter.
Explain agent data handling and retention in the public privacy policy.

Keep concurrent MCP expense writes independent by publishing complete individual
chunks and balances before linking them to a party. Route widget navigation
through the MCP Apps host bridge, with a copyable link when unavailable.

Allow agents to add participants as a group grows, including people introduced
while recording expenses. Preserve existing identities and past splits, return
new participant IDs, and apply the existing retry and anonymous analytics rules.

Add tools for party details, participant renaming/archival/restoration, and full
expense reads, edits, and deletion. Require current expense versions, preserve
unspecified fields and attachments, and reconcile shared balances after changes.
Reuse existing write protection and anonymous completion events without a new
migration or MCP state cache.

Build the embedded group widget with the shared trizum design system: buttons,
avatars, alerts, icons, typography, and theme colors. Embed the generated assets
and follow the MCP host’s light/dark theme while retaining sandbox-safe navigation.

Keep previously published widget URLs readable for clients with cached tool
metadata, and reduce embedded font payloads while retaining the shared UI.

Use the host’s frame for the embedded widget, removing its nested card surface.

Apply trizum’s shared background colors to the widget document and include
responsive content padding in host-driven height measurements.

Guide visitors from agent-created parties to platform-specific app downloads or
the existing web join flow. Preserve canonical invite compatibility, offer a
desktop QR code and copyable link, and keep attribution limited to approved UTM
labels under existing analytics privacy gates. Store clicks measure intent only;
party context stays in the original invite without deferred-install tracking.

Keep native app links on the existing associated domain and serve production
browser download choices from a separate custom domain on the same Worker.
This lets Safari launch an already-installed app from the handoff page, while
preserving the party and approved campaign labels for app and web choices.

Include the known party link when creation loses its sync acknowledgement, so
agents can check the uncertain result without creating another group. Keep the
write unconfirmed and preserve existing retry protection without extra database
operations.

Return canonical app-associated invite URLs from preview and Worker aliases too,
so installed apps can open directly from agent widgets without a download page.
