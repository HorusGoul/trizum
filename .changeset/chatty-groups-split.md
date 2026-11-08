---
"@trizum/pwa": minor
"@trizum/mcp": minor
"@trizum/analytics": minor
---

Add an anonymous ChatGPT app and MCP endpoint for creating and managing shared
expense groups without signing in. Support party details, participant additions,
renaming and archival/restoration, plus expense reads, creation, edits and deletion.
Reuse existing Automerge models, money and expense helpers, and balance calculation.

Execute MCP tools directly through on-demand Automerge sync, without D1 access,
request IDs, signed tokens, preparation calls or retry bookkeeping. Repeated
creations produce separate groups or expenses. Existing reads and version-checked
expense deletion let agents inspect and resolve unwanted duplicates. Keep edge
write limits and count anonymous completed tool actions through shared analytics.
Remove the experimental retry table with migration 0008 while preserving the
already-applied 0007 migration in history, and remove its cleanup schedule.

Publish independent expense and balance documents before linking them to the
group, preserving concurrent additions. Patch existing records without replacing
identities, attachments, custom splits or unspecified fields. Return a known group
link when a new party's sync acknowledgement cannot be confirmed.

Build the embedded widget with shared trizum UI components, fonts, icons and theme
colors. Follow host light/dark themes, keep previously published widget URLs
readable, embed all assets, and include responsive padding in host height
measurements. Use host-mediated navigation and a copyable fallback.
Describe the widget's contents to ChatGPT and request brief confirmations without
duplicating its balances, expenses and links in the assistant response. Retain
text summaries for explicit requests and clients without widget support.
Return presentation guidance alongside successful party results instead of a
second JSON copy, preserving the full structured data for follow-up actions.

Return canonical app-associated invite URLs from all MCP hosts. Installed apps can
open directly; browser visitors receive app-download or web choices on a separate
custom domain hosted by the same Worker. Identify the download page with the
sign-in screen's small logo treatment beside the lowercase trizum name and a
"Your party is ready" heading, localized in English and Spanish.
Space the branding, headings and sections consistently, with a
separate emoji gap and aligned wrapping for long group names. Keep mobile content
near the top with comfortable padding. Preserve the party through desktop QR codes, invite copying
and the existing web join flow. Track only approved campaign labels under existing
analytics privacy gates, with no deferred-install tracking.
